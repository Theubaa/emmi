import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Loader2, ArrowLeft, GripVertical, Mail } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name required'),
  from_name: z.string().optional(),
  reply_to: z.string().email().optional().or(z.literal('')),
  stop_on_reply: z.boolean().default(true),
  stop_on_unsubscribe: z.boolean().default(true),
  stop_on_bounce: z.boolean().default(true),
  daily_send_limit: z.coerce.number().int().min(1).max(2000).default(100),
  sending_start_hour: z.coerce.number().int().min(0).max(23).default(9),
  sending_end_hour: z.coerce.number().int().min(0).max(23).default(17),
  timezone: z.string().default('UTC'),
  track_opens: z.boolean().default(true),
  track_clicks: z.boolean().default(false),
})

type CampaignForm = z.infer<typeof campaignSchema>

interface SequenceStep {
  step_number: number
  subject: string
  body_html: string
  body_text: string
  delay_days: number
  delay_hours: number
}

const VARIABLE_HELP = [
  { label: '{{first_name}}', desc: "Lead's first name" },
  { label: '{{last_name}}', desc: "Lead's last name" },
  { label: '{{company}}', desc: "Lead's company" },
  { label: '{{email}}', desc: "Lead's email" },
  { label: '{{job_title}}', desc: "Lead's job title" },
]

export function CampaignCreatePage() {
  const [steps, setSteps] = useState<SequenceStep[]>([
    { step_number: 1, subject: '', body_html: '', body_text: '', delay_days: 0, delay_hours: 0 },
  ])
  const [activeStep, setActiveStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { currentWorkspace } = useAuthStore()
  const workspaceId = currentWorkspace?.id
  const navigate = useNavigate()

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      stop_on_reply: true,
      stop_on_unsubscribe: true,
      stop_on_bounce: true,
      daily_send_limit: 100,
      sending_start_hour: 9,
      sending_end_hour: 17,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      track_opens: true,
      track_clicks: false,
    },
  })

  const { data: emailAccounts } = useQuery({
    queryKey: ['email-accounts', workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('email_accounts')
        .select('id, email, display_name, status')
        .eq('workspace_id', workspaceId!)
        .eq('status', 'connected')
      return data || []
    },
    enabled: !!workspaceId,
  })

  const addStep = () => {
    const lastStep = steps[steps.length - 1]
    setSteps([...steps, {
      step_number: steps.length + 1,
      subject: `Follow-up ${steps.length}`,
      body_html: '',
      body_text: '',
      delay_days: lastStep.delay_days + 2,
      delay_hours: 0,
    }])
    setActiveStep(steps.length)
  }

  const removeStep = (index: number) => {
    if (steps.length === 1) return
    const newSteps = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_number: i + 1 }))
    setSteps(newSteps)
    setActiveStep(Math.max(0, activeStep - (index <= activeStep ? 1 : 0)))
  }

  const updateStep = (index: number, field: keyof SequenceStep, value: string | number) => {
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    setSteps(newSteps)
  }

  const onSubmit = async (data: CampaignForm) => {
    if (!workspaceId) return
    if (steps.some(s => !s.subject || !s.body_text)) {
      toast({ title: 'Incomplete steps', description: 'All sequence steps must have a subject and body.', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    try {
      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          workspace_id: workspaceId,
          name: data.name,
          status: 'draft',
          from_name: data.from_name || null,
          reply_to: data.reply_to || null,
          stop_on_reply: data.stop_on_reply,
          stop_on_unsubscribe: data.stop_on_unsubscribe,
          stop_on_bounce: data.stop_on_bounce,
          daily_send_limit: data.daily_send_limit,
          sending_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          sending_start_hour: data.sending_start_hour,
          sending_end_hour: data.sending_end_hour,
          timezone: data.timezone,
          track_opens: data.track_opens,
          track_clicks: data.track_clicks,
          total_leads: 0,
          emails_sent: 0,
          emails_delivered: 0,
          emails_opened: 0,
          emails_clicked: 0,
          emails_replied: 0,
          emails_bounced: 0,
          emails_unsubscribed: 0,
        })
        .select()
        .single()

      if (campaignError) throw campaignError

      // Create sequence steps
      const sequenceData = steps.map(step => ({
        campaign_id: campaign.id,
        workspace_id: workspaceId,
        step_number: step.step_number,
        subject: step.subject,
        body_html: step.body_html || `<p>${step.body_text}</p>`,
        body_text: step.body_text,
        delay_days: step.delay_days,
        delay_hours: step.delay_hours,
      }))

      const { error: seqError } = await supabase.from('campaign_sequences').insert(sequenceData)
      if (seqError) throw seqError

      toast({ title: 'Campaign created!', description: `"${data.name}" is ready. Add leads to activate it.` })
      navigate(`/campaigns/${campaign.id}`)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Campaign</h1>
          <p className="text-muted-foreground">Set up your email sequence</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Sequence builder */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Sequence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Step selector */}
                <div className="flex items-center gap-2 flex-wrap">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveStep(i)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          activeStep === i ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        Step {step.step_number}
                        {step.delay_days > 0 ? ` (Day ${step.delay_days})` : ' (Day 0)'}
                      </button>
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(i)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                      {i < steps.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addStep}>
                    <Plus className="h-3 w-3 mr-1" /> Add Step
                  </Button>
                </div>

                {/* Step editor */}
                {steps[activeStep] && (
                  <div className="space-y-4 border rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Delay Days (from previous step)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={steps[activeStep].delay_days}
                          onChange={e => updateStep(activeStep, 'delay_days', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Delay Hours</Label>
                        <Input
                          type="number"
                          min="0"
                          max="23"
                          value={steps[activeStep].delay_hours}
                          onChange={e => updateStep(activeStep, 'delay_hours', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Subject Line *</Label>
                      <Input
                        placeholder="e.g., Quick question about {{company}}"
                        value={steps[activeStep].subject}
                        onChange={e => updateStep(activeStep, 'subject', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email Body *</Label>
                      <Textarea
                        placeholder="Hi {{first_name}},&#10;&#10;I wanted to reach out about..."
                        className="min-h-[200px] font-mono text-sm"
                        value={steps[activeStep].body_text}
                        onChange={e => {
                          updateStep(activeStep, 'body_text', e.target.value)
                          updateStep(activeStep, 'body_html', `<p>${e.target.value.replace(/\n/g, '</p><p>')}</p>`)
                        }}
                      />
                    </div>
                    {/* Variable help */}
                    <div className="flex flex-wrap gap-2">
                      {VARIABLE_HELP.map(v => (
                        <button
                          key={v.label}
                          type="button"
                          className="text-xs bg-muted px-2 py-1 rounded hover:bg-primary/10 hover:text-primary transition-colors"
                          title={v.desc}
                          onClick={() => {
                            const current = steps[activeStep].body_text
                            updateStep(activeStep, 'body_text', current + v.label)
                          }}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Campaign settings */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Campaign Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign Name *</Label>
                  <Input id="name" placeholder="Cold outreach Q1 2025" {...register('name')} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="from_name">From Name</Label>
                  <Input id="from_name" placeholder="John Doe" {...register('from_name')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reply_to">Reply-To Email</Label>
                  <Input id="reply_to" type="email" placeholder="replies@example.com" {...register('reply_to')} />
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Sending Schedule</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Start Hour</Label>
                      <Input type="number" min="0" max="23" {...register('sending_start_hour')} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Hour</Label>
                      <Input type="number" min="0" max="23" {...register('sending_end_hour')} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Daily Send Limit</Label>
                    <Input type="number" min="1" max="2000" {...register('daily_send_limit')} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Stopping Conditions</Label>
                  {[
                    { field: 'stop_on_reply', label: 'Stop on reply' },
                    { field: 'stop_on_unsubscribe', label: 'Stop on unsubscribe' },
                    { field: 'stop_on_bounce', label: 'Stop on bounce' },
                  ].map(({ field, label }) => (
                    <div key={field} className="flex items-center justify-between">
                      <Label className="font-normal">{label}</Label>
                      <Switch
                        defaultChecked
                        onCheckedChange={(v) => setValue(field as any, v)}
                      />
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Tracking</Label>
                  {[
                    { field: 'track_opens', label: 'Track opens (estimated)', defaultChecked: true },
                    { field: 'track_clicks', label: 'Track clicks', defaultChecked: false },
                  ].map(({ field, label, defaultChecked }) => (
                    <div key={field} className="flex items-center justify-between">
                      <Label className="font-normal">{label}</Label>
                      <Switch
                        defaultChecked={defaultChecked}
                        onCheckedChange={(v) => setValue(field as any, v)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Campaign
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
