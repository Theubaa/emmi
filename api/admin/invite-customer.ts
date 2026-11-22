import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://gftrwaufvhemzbieklfl.supabase.co'
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY

  if (!supabaseServiceKey) {
    return res.status(500).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY environment variable is not configured in Vercel.',
      hint: 'Please add SUPABASE_SERVICE_ROLE_KEY under Vercel Project Settings > Environment Variables.',
    })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const { name, email, ownerName, plan = 'starter' } = body

    if (!name || !email) {
      return res.status(400).json({ error: 'Company name and customer email are required' })
    }

    const host = req.headers.host || 'emmi.vascularexpert.in'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`
    const redirectTo = `${baseUrl}/set-password`

    // 1. Create or Update Customer record
    const { data: existingCustomer } = await adminClient
      .from('customers')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    let customerId = existingCustomer?.id

    if (!customerId) {
      const { data: newCust, error: custError } = await adminClient
        .from('customers')
        .insert({
          name,
          email,
          plan,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (custError) {
        return res.status(500).json({ error: `Customer creation failed: ${custError.message}` })
      }
      customerId = newCust.id
    } else {
      await adminClient
        .from('customers')
        .update({ name, plan, status: 'active', updated_at: new Date().toISOString() })
        .eq('id', customerId)
    }

    // 2. Create Workspace
    const wsSlug =
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
      '-' +
      Math.random().toString(36).substring(2, 6)

    const { data: ws, error: wsError } = await adminClient
      .from('workspaces')
      .insert({
        customer_id: customerId,
        name: `${name} Workspace`,
        slug: wsSlug,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    const workspaceId = ws?.id

    // 3. Send Supabase Auth Invite Email to customer
    let userId: string | null = null
    let inviteLink: string | null = null

    // Attempt to invite user via Supabase Auth
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name: ownerName || name,
        },
        redirectTo,
      }
    )

    if (inviteError) {
      // If user already exists in auth.users, generate a password recovery / invite link instead
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'invite',
        email,
        options: { redirectTo },
      })

      if (linkError) {
        // Fallback to recovery link if already registered
        const { data: recoveryData, error: recoveryError } =
          await adminClient.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: { redirectTo },
          })

        if (recoveryError) {
          return res.status(400).json({ error: inviteError.message })
        }
        userId = recoveryData?.user?.id || null
        inviteLink = recoveryData?.properties?.action_link || null
      } else {
        userId = linkData?.user?.id || null
        inviteLink = linkData?.properties?.action_link || null
      }
    } else {
      userId = inviteData?.user?.id || null
      // Also generate direct action link so Super Admin has immediate backup
      try {
        const { data: linkData } = await adminClient.auth.admin.generateLink({
          type: 'invite',
          email,
          options: { redirectTo },
        })
        inviteLink = linkData?.properties?.action_link || null
      } catch {
        // Continue even if link generation fails
      }
    }

    // 4. Update or Insert Profile
    if (userId) {
      await adminClient.from('profiles').upsert({
        id: userId,
        email,
        full_name: ownerName || name,
        is_super_admin: false,
        updated_at: new Date().toISOString(),
      })

      // 5. Add user as Owner of the Workspace
      if (workspaceId) {
        await adminClient.from('workspace_members').upsert(
          {
            workspace_id: workspaceId,
            user_id: userId,
            role: 'owner',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id,user_id' }
        )
      }
    }

    // 6. Audit log
    try {
      await adminClient.from('audit_logs').insert({
        action: 'admin_invite_customer',
        resource_type: 'customer',
        resource_id: customerId,
        metadata: { name, email, plan, workspace_id: workspaceId, user_id: userId },
      })
    } catch {
      // Ignore audit log error
    }

    return res.status(200).json({
      success: true,
      email,
      customerId,
      workspaceId,
      userId,
      inviteLink,
      message: `Invitation email sent to ${email}.`,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error while inviting customer.' })
  }
}
