import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured in Vercel environment' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    const { error } = await adminClient.auth.admin.deleteUser(userId)
    if (error) {
      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' })
  }
}
