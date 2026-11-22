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
