import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type RegisterForm = z.infer<typeof registerSchema>

export function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterForm) => {
    const { error } = await signUp(data.email, data.password, data.fullName)
    if (error) {
      toast({ title: 'Registration failed', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Account created!', description: 'Please check your email to verify your account.' })
      navigate('/login')
    }
  }

  return (
    <Card className="bg-white/5 backdrop-blur border-white/10">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-white">Create account</CardTitle>
        <CardDescription className="text-slate-400">
          Start your email outreach journey
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-slate-200">Full Name</Label>
            <Input id="fullName" placeholder="John Doe" className="bg-white/5 border-white/20 text-white placeholder:text-slate-500" {...register('fullName')} />
            {errors.fullName && <p className="text-red-400 text-xs">{errors.fullName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" className="bg-white/5 border-white/20 text-white placeholder:text-slate-500" {...register('email')} />
            {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-200">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="bg-white/5 border-white/20 text-white placeholder:text-slate-500 pr-10"
                {...register('password')}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-slate-200">Confirm Password</Label>
            <Input id="confirmPassword" type="password" placeholder="••••••••" className="bg-white/5 border-white/20 text-white placeholder:text-slate-500" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword.message}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Account
          </Button>
          <p className="text-sm text-slate-400 text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300">Sign in</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
