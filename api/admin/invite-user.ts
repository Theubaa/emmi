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
    const { email, fullName, isSuperAdmin, workspaceId } = body

    if (!email) {
      return res.status(400).json({ error: 'User email is required' })
    }

    const host = req.headers.host || 'emmi.vascularexpert.in'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`
    const redirectTo = `${baseUrl}/set-password`

    let userId: string | null = null
    let inviteLink: string | null = null

    // Invite user via Supabase Auth
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: fullName || '' },
        redirectTo,
      }
    )

    if (inviteError) {
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'invite',
        email,
        options: { redirectTo },
      })

      if (linkError) {
        const { data: recData, error: recError } = await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo },
        })
        if (recError) return res.status(400).json({ error: inviteError.message })
        userId = recData?.user?.id || null
        inviteLink = recData?.properties?.action_link || null
      } else {
        userId = linkData?.user?.id || null
        inviteLink = linkData?.properties?.action_link || null
      }
    } else {
      userId = inviteData?.user?.id || null
      try {
        const { data: linkData } = await adminClient.auth.admin.generateLink({
          type: 'invite',
          email,
          options: { redirectTo },
        })
        inviteLink = linkData?.properties?.action_link || null
      } catch {
        // Continue
      }
    }

    if (userId) {
      await adminClient.from('profiles').upsert({
        id: userId,
        email,
        full_name: fullName || null,
        is_super_admin: !!isSuperAdmin,
        updated_at: new Date().toISOString(),
      })

      if (workspaceId) {
        await adminClient.from('workspace_members').upsert(
          {
            workspace_id: workspaceId,
            user_id: userId,
            role: 'member',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id,user_id' }
        )
      }
    }

    try {
      await adminClient.from('audit_logs').insert({
        action: 'admin_invite_user',
        resource_type: 'user',
        resource_id: userId,
        metadata: { email, is_super_admin: !!isSuperAdmin, workspace_id: workspaceId },
      })
    } catch {
      // Ignore
    }

    return res.status(200).json({
      success: true,
      email,
      userId,
      inviteLink,
      message: `Invitation email sent to ${email}.`,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error while inviting user.' })
  }
}
