import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const workspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters').max(50),
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters')
    .max(30)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
})

type WorkspaceForm = z.infer<typeof workspaceSchema>

export function WorkspaceSetupPage() {
  const { user, setCurrentWorkspace, setWorkspaces, workspaces } = useAuthStore()
  const navigate = useNavigate()

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<WorkspaceForm>({
    resolver: zodResolver(workspaceSchema),
  })

  const watchName = watch('name', '')

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    setValue('name', name)
    setValue('slug', slug)
  }

  const onSubmit = async (data: WorkspaceForm) => {
    if (!user) return

    try {
      // Check if slug is taken
      const { data: existing } = await supabase
        .from('workspaces')
        .select('id')
        .eq('slug', data.slug)
        .single()

      if (existing) {
        toast({ title: 'Slug taken', description: 'Please choose a different slug.', variant: 'destructive' })
        return
      }

      // Create workspace
      const { data: workspace, error } = await supabase
        .from('workspaces')
        .insert({
          name: data.name,
          slug: data.slug,
          customer_id: user.id,
          settings: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            sending_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            sending_start_hour: 9,
            sending_end_hour: 17,
            daily_send_limit: 100,
            track_opens: true,
            track_clicks: false,
            unsubscribe_text: 'If you no longer wish to receive these emails, click here to unsubscribe.',
          },
          status: 'active',
        })
        .select()
        .single()

      if (error) throw error

      // Add owner membership
      await supabase.from('workspace_members').insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'owner',
      })

      toast({ title: 'Workspace created!', description: `Welcome to ${data.name}` })
      setCurrentWorkspace(workspace)
      setWorkspaces([...workspaces, workspace])
      navigate('/')
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <span className="text-2xl font-bold text-white">Emmil</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Create your workspace</h1>
          <p className="text-slate-400">Set up your team's email outreach workspace</p>
        </div>

        <Card className="bg-white/5 backdrop-blur border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-400" />
              Workspace Details
            </CardTitle>
            <CardDescription className="text-slate-400">
              You can always change these settings later
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-200">Workspace Name</Label>
                <Input
                  id="name"
                  placeholder="Acme Corp"
                  className="bg-white/5 border-white/20 text-white placeholder:text-slate-500"
                  {...register('name')}
                  onChange={handleNameChange}
                />
                {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug" className="text-slate-200">Workspace URL</Label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-sm whitespace-nowrap">emmil.app/</span>
                  <Input
                    id="slug"
                    placeholder="acme-corp"
                    className="bg-white/5 border-white/20 text-white placeholder:text-slate-500"
                    {...register('slug')}
                  />
                </div>
                {errors.slug && <p className="text-red-400 text-xs">{errors.slug.message}</p>}
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Workspace
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
