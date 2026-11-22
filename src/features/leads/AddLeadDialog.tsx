import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const leadSchema = z.object({
  email: z.string().email('Invalid email'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  job_title: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
})

type LeadForm = z.infer<typeof leadSchema>

export function AddLeadDialog({ open, onOpenChange, workspaceId }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
}) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
  })

  const onSubmit = async (data: LeadForm) => {
    // Check for duplicate
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('email', data.email)
      .single()

    if (existing) {
      toast({ title: 'Duplicate lead', description: 'A lead with this email already exists.', variant: 'destructive' })
      return
    }

    const { error } = await supabase.from('leads').insert({
      workspace_id: workspaceId,
      email: data.email,
      first_name: data.first_name || null,
      last_name: data.last_name || null,
      company: data.company || null,
      job_title: data.job_title || null,
      phone: data.phone || null,
      website: data.website || null,
      status: 'active',
      email_validation_status: 'unknown',
      custom_fields: {},
      tags: [],
      unsubscribed: false,
      bounced: false,
    })

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Lead added!', description: `${data.email} has been added.` })
      queryClient.invalidateQueries({ queryKey: ['leads', workspaceId] })
      reset()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" placeholder="john@example.com" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input placeholder="John" {...register('first_name')} />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input placeholder="Doe" {...register('last_name')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company</Label>
              <Input placeholder="Acme Corp" {...register('company')} />
            </div>
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Input placeholder="CEO" {...register('job_title')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input placeholder="+1 234 567 8900" {...register('phone')} />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input placeholder="https://example.com" {...register('website')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
