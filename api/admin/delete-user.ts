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
    const { userId } = body

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    const { error } = await adminClient.auth.admin.deleteUser(userId)
    if (error) {
      return res.status(400).json({ error: error.message })
    }

    await adminClient.from('workspace_members').delete().eq('user_id', userId)
    await adminClient.from('profiles').delete().eq('id', userId)

    return res.status(200).json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' })
  }
}
