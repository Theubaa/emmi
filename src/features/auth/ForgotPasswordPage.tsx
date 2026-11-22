import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const forgotSchema = z.object({
  email: z.string().email('Invalid email address'),
})

type ForgotForm = z.infer<typeof forgotSchema>

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const { register, handleSubmit, formState: { errors, isSubmitting, isSubmitSuccessful } } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  })

  const onSubmit = async (data: ForgotForm) => {
    const { error } = await resetPassword(data.email)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Email sent!', description: 'Check your email for a password reset link.' })
    }
  }

  return (
    <Card className="bg-white/5 backdrop-blur border-white/10">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-white">Reset password</CardTitle>
        <CardDescription className="text-slate-400">
          Enter your email and we'll send you a reset link
        </CardDescription>
      </CardHeader>
      {isSubmitSuccessful ? (
        <CardContent className="text-center py-6">
          <div className="text-green-400 mb-4">✓ Reset link sent!</div>
          <p className="text-slate-400 text-sm">Check your email inbox and follow the link to reset your password.</p>
        </CardContent>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" className="bg-white/5 border-white/20 text-white placeholder:text-slate-500" {...register('email')} />
              {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Reset Link
            </Button>
          </CardFooter>
        </form>
      )}
      <div className="pb-6 text-center">
        <Link to="/login" className="text-sm text-slate-400 hover:text-slate-200 inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to sign in
        </Link>
      </div>
    </Card>
  )
}
