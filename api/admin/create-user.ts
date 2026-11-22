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
      hint: 'Please add SUPABASE_SERVICE_ROLE_KEY under Vercel Project Settings > Environment Variables, or use the Supabase SQL RPC method.',
    })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const { email, password, fullName, isSuperAdmin } = body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || '' },
    })

    if (authError) {
      return res.status(400).json({ error: authError.message })
    }

    if (authData?.user) {
      await adminClient.from('profiles').upsert({
        id: authData.user.id,
        email: authData.user.email,
        full_name: fullName || null,
        is_super_admin: !!isSuperAdmin,
        updated_at: new Date().toISOString(),
      })

      try {
        await adminClient.from('audit_logs').insert({
          action: 'admin_create_user',
          resource_type: 'user',
          resource_id: authData.user.id,
          metadata: { email, is_super_admin: !!isSuperAdmin },
        })
      } catch {
        // Continue even if audit log fails
      }
    }

    return res.status(200).json({ success: true, user: authData.user })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' })
  }
}
