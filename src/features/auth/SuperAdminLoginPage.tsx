import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Eye, EyeOff, ShieldAlert, Lock, Terminal } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const superAdminLoginSchema = z.object({
  email: z.string().email('Please enter a valid administrator email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type SuperAdminLoginForm = z.infer<typeof superAdminLoginSchema>

export function SuperAdminLoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const { signIn } = useAuth()
  const { setUser } = useAuthStore()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SuperAdminLoginForm>({
    resolver: zodResolver(superAdminLoginSchema),
  })

  const onSubmit = async (data: SuperAdminLoginForm) => {
    try {
      const { error } = await signIn(data.email, data.password)
      if (error) {
        toast({
          title: 'Authentication Denied',
          description: error.message,
          variant: 'destructive',
        })
        return
      }

      // Verify the user is actually a Super Admin
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id

      if (!userId) {
        throw new Error('Failed to retrieve user session')
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileErr || !profile || !profile.is_super_admin) {
        // Kick them out immediately if they are not super admin
        await supabase.auth.signOut()
        toast({
          title: 'Access Forbidden',
          description: 'This console is strictly reserved for Super Administrators.',
          variant: 'destructive',
        })
        return
      }

      setUser(profile)
      toast({
        title: 'Super Admin Verified',
        description: `Welcome back, ${profile.full_name || profile.email}`,
      })
      navigate('/super-user', { replace: true })
    } catch (err: any) {
      toast({
        title: 'Login Error',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 shadow-lg shadow-orange-500/10 mb-2">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            Super Admin Console
          </h1>
          <p className="text-xs text-zinc-400 uppercase tracking-widest font-mono">
            Elevated Access Control · Emmil Platform
          </p>
        </div>

        {/* Login Card */}
        <Card className="bg-zinc-900/90 backdrop-blur-xl border-zinc-800 shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white">System Authentication</CardTitle>
              <Badge variant="outline" className="border-orange-500/40 text-orange-400 text-[10px] uppercase font-mono">
                Root Level
              </Badge>
            </div>
            <CardDescription className="text-xs text-zinc-400">
              Enter your verified master administrator credentials.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="admin-email" className="text-xs text-zinc-300 font-medium">
                  Administrator Email
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@emmil.com"
                  className="bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-orange-500"
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-rose-400">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-password" className="text-xs text-zinc-300 font-medium">
                  Master Password
                </Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    className="bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-600 pr-10 focus-visible:ring-orange-500"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-rose-400">{errors.password.message}</p>}
              </div>

              <div className="rounded-lg bg-orange-950/30 border border-orange-500/20 p-3 flex items-start gap-2.5">
                <Lock className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-orange-300 leading-relaxed">
                  All connection sessions and administrative actions in this console are cryptographically signed and logged in the immutable security audit trail.
                </p>
              </div>
            </CardContent>

            <CardFooter className="pt-2 flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-md shadow-orange-600/20"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating Session...
                  </>
                ) : (
                  'Authorize & Enter Console'
                )}
              </Button>

              <div className="text-center">
                <a
                  href="/login"
                  className="text-xs text-zinc-500 hover:text-zinc-400 font-mono transition-colors"
                >
                  Return to Standard User Portal
                </a>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
