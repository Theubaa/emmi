import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Eye, EyeOff, CheckCircle2, Lock, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const setPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

type SetPasswordForm = z.infer<typeof setPasswordSchema>

export function SetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordForm>({
    resolver: zodResolver(setPasswordSchema),
  })

  useEffect(() => {
    // Check if session exists (Supabase automatically exchanges the hash token)
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUserEmail(session.user.email || null)
          setIsVerifying(false)
          return
        }

        // Listen for auth state change in case token exchange is happening
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
          if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || currentSession?.user) {
            setUserEmail(currentSession?.user?.email || null)
            setIsVerifying(false)
          }
        })

        // Timeout fallback after 3 seconds if no session is detected
        const timer = setTimeout(() => {
          setIsVerifying(false)
        }, 3000)

        return () => {
          subscription.unsubscribe()
          clearTimeout(timer)
        }
      } catch {
        setIsVerifying(false)
      }
    }

    checkSession()
  }, [location])

  const onSubmit = async (data: SetPasswordForm) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      })

      if (error) {
        toast({
          title: 'Failed to Set Password',
          description: error.message,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Account Activated!',
        description: 'Your password has been set. Please sign in with your new credentials.',
      })

      // Clean session and redirect to login
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Something went wrong while setting password.',
        variant: 'destructive',
      })
    }
  }

  if (isVerifying) {
    return (
      <Card className="bg-white/5 backdrop-blur border-white/10 shadow-2xl">
        <CardContent className="p-12 text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-sm text-slate-300 font-medium">Verifying your invitation token...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white/5 backdrop-blur border-white/10 shadow-2xl">
      <CardHeader className="space-y-1">
        <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-2">
          <Lock className="h-5 w-5" />
        </div>
        <CardTitle className="text-2xl text-white">Set Your Password</CardTitle>
        <CardDescription className="text-slate-400">
          {userEmail ? (
            <>
              Welcome! Set a password for <span className="text-white font-medium">{userEmail}</span> to complete your workspace setup.
            </>
          ) : (
            'Enter your new password to activate your account.'
          )}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-200">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimum 8 characters"
                className="bg-white/5 border-white/20 text-white placeholder:text-slate-500 pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-slate-200">
              Confirm Password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter password"
                className="bg-white/5 border-white/20 text-white placeholder:text-slate-500 pr-10"
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-400 text-xs">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-200 leading-relaxed">
              Once set, your account will be activated and you will be redirected to the sign-in page to access your workspace.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting Password & Activating...
              </>
            ) : (
              'Activate Account & Continue'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
