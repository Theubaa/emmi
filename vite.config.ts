import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createClient } from '@supabase/supabase-js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

  return {
    plugins: [
      react(),
      {
        name: 'super-admin-api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url === '/api/admin/create-user' && req.method === 'POST') {
              let body = ''
              req.on('data', (chunk) => {
                body += chunk
              })
              req.on('end', async () => {
                try {
                  const { email, password, fullName, isSuperAdmin } = JSON.parse(body)
                  if (!email || !password) {
                    res.statusCode = 400
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ error: 'Email and password are required' }))
                    return
                  }

                  if (!supabaseUrl || !supabaseServiceKey) {
                    res.statusCode = 500
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured in .env' }))
                    return
                  }

                  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
                    auth: { autoRefreshToken: false, persistSession: false },
                  })

                  // Create user in auth.users
                  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                    user_metadata: { full_name: fullName || '' },
                  })

                  if (authError) {
                    res.statusCode = 400
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ error: authError.message }))
                    return
                  }

                  // Update or insert profile
                  if (authData?.user) {
                    await adminClient
                      .from('profiles')
                      .upsert({
                        id: authData.user.id,
                        email: authData.user.email,
                        full_name: fullName || null,
                        is_super_admin: !!isSuperAdmin,
                        updated_at: new Date().toISOString(),
                      })

                    // Log audit event
                    await adminClient.from('audit_logs').insert({
                      action: 'admin_create_user',
                      resource_type: 'user',
                      resource_id: authData.user.id,
                      metadata: { email, is_super_admin: !!isSuperAdmin },
                    })
                  }

                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ success: true, user: authData.user }))
                } catch (err: any) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: err.message || 'Internal server error' }))
                }
              })
              return
            }

            if (req.url === '/api/admin/invite-customer' && req.method === 'POST') {
              let body = ''
              req.on('data', (chunk) => { body += chunk })
              req.on('end', async () => {
                try {
                  const { name, email, ownerName, plan = 'starter' } = JSON.parse(body)
                  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
                    auth: { autoRefreshToken: false, persistSession: false },
                  })

                  const redirectTo = 'https://emmi.vascularexpert.in/set-password'

                  // 1. Create or Update Customer
                  const { data: existingCustomer } = await adminClient
                    .from('customers')
                    .select('id')
                    .eq('email', email)
                    .maybeSingle()

                  let customerId = existingCustomer?.id
                  if (!customerId) {
                    const { data: newCust, error: custError } = await adminClient
                      .from('customers')
                      .insert({ name, email, plan, status: 'active' })
                      .select('id')
                      .single()
                    if (custError) throw custError
                    customerId = newCust.id
                  }

                  // 2. Create Workspace
                  const wsSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6)
                  const { data: ws } = await adminClient
                    .from('workspaces')
                    .insert({ customer_id: customerId, name: `${name} Workspace`, slug: wsSlug, status: 'active' })
                    .select('id')
                    .single()

                  // 3. Send Invite Email via Supabase
                  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
                    data: { full_name: ownerName || name },
                    redirectTo,
                  })

                  let inviteLink = null
                  try {
                    const { data: linkData } = await adminClient.auth.admin.generateLink({
                      type: 'invite',
                      email,
                      options: { redirectTo },
                    })
                    inviteLink = linkData?.properties?.action_link || null
                  } catch {}

                  const userId = inviteData?.user?.id
                  if (userId) {
                    await adminClient.from('profiles').upsert({ id: userId, email, full_name: ownerName || name, is_super_admin: false })
                    if (ws?.id) {
                      await adminClient.from('workspace_members').upsert({ workspace_id: ws.id, user_id: userId, role: 'owner' })
                    }
                  }

                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ success: true, email, inviteLink, customerId, workspaceId: ws?.id }))
                } catch (err: any) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: err.message }))
                }
              })
              return
            }

            if (req.url === '/api/admin/invite-user' && req.method === 'POST') {
              let body = ''
              req.on('data', (chunk) => { body += chunk })
              req.on('end', async () => {
                try {
                  const { email, fullName, isSuperAdmin, workspaceId } = JSON.parse(body)
                  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
                    auth: { autoRefreshToken: false, persistSession: false },
                  })
                  const redirectTo = 'https://emmi.vascularexpert.in/set-password'

                  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
                    data: { full_name: fullName || '' },
                    redirectTo,
                  })

                  let inviteLink = null
                  try {
                    const { data: linkData } = await adminClient.auth.admin.generateLink({
                      type: 'invite',
                      email,
                      options: { redirectTo },
                    })
                    inviteLink = linkData?.properties?.action_link || null
                  } catch {}

                  const userId = inviteData?.user?.id
                  if (userId) {
                    await adminClient.from('profiles').upsert({ id: userId, email, full_name: fullName || null, is_super_admin: !!isSuperAdmin })
                    if (workspaceId) {
                      await adminClient.from('workspace_members').upsert({ workspace_id: workspaceId, user_id: userId, role: 'member' })
                    }
                  }

                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ success: true, email, inviteLink }))
                } catch (err: any) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: err.message }))
                }
              })
              return
            }

            if (req.url === '/api/admin/delete-user' && req.method === 'POST') {
              let body = ''
              req.on('data', (chunk) => {
                body += chunk
              })
              req.on('end', async () => {
                try {
                  const { userId } = JSON.parse(body)
                  if (!userId) {
                    res.statusCode = 400
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ error: 'User ID is required' }))
                    return
                  }

                  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
                    auth: { autoRefreshToken: false, persistSession: false },
                  })

                  // Delete from auth.users (cascades to profiles)
                  const { error } = await adminClient.auth.admin.deleteUser(userId)
                  if (error) {
                    res.statusCode = 400
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ error: error.message }))
                    return
                  }

                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ success: true }))
                } catch (err: any) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: err.message }))
                }
              })
              return
            }

            next()
          })
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
