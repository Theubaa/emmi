import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Settings, Building, User, Clock, ShieldCheck, Save, MailCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const workspaceSettingsSchema = z.object({
  name: z.string().min(2, 'Workspace name required'),
  timezone: z.string(),
  daily_send_limit: z.coerce.number().min(1).max(10000),
  sending_start_hour: z.coerce.number().min(0).max(23),
  sending_end_hour: z.coerce.number().min(0).max(23),
  track_opens: z.boolean(),
  track_clicks: z.boolean(),
  unsubscribe_text: z.string(),
})

type WorkspaceSettingsForm = z.infer<typeof workspaceSettingsSchema>

const profileSchema = z.object({
  full_name: z.string().min(2, 'Full name required'),
})

type ProfileForm = z.infer<typeof profileSchema>

export function SettingsPage() {
  const { currentWorkspace, user, setUser, setCurrentWorkspace } = useAuthStore()
  const [savingWorkspace, setSavingWorkspace] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  const { register: registerWorkspace, handleSubmit: handleWorkspaceSubmit, setValue: setWsValue, formState: { errors: wsErrors } } = useForm<WorkspaceSettingsForm>({
    resolver: zodResolver(workspaceSettingsSchema),
    defaultValues: {
      name: currentWorkspace?.name || '',
      timezone: currentWorkspace?.settings?.timezone || 'UTC',
      daily_send_limit: currentWorkspace?.settings?.daily_send_limit || 200,
      sending_start_hour: currentWorkspace?.settings?.sending_start_hour || 9,
      sending_end_hour: currentWorkspace?.settings?.sending_end_hour || 18,
      track_opens: currentWorkspace?.settings?.track_opens ?? true,
      track_clicks: currentWorkspace?.settings?.track_clicks ?? false,
      unsubscribe_text: currentWorkspace?.settings?.unsubscribe_text || 'If you wish to stop receiving these emails, please click here to unsubscribe.',
    },
  })

  const { register: registerProfile, handleSubmit: handleProfileSubmit } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name || '',
    },
  })

  const onSaveWorkspace = async (data: WorkspaceSettingsForm) => {
    if (!currentWorkspace) return
    setSavingWorkspace(true)
    try {
      const updatedSettings = {
        ...currentWorkspace.settings,
        timezone: data.timezone,
        daily_send_limit: data.daily_send_limit,
        sending_start_hour: data.sending_start_hour,
        sending_end_hour: data.sending_end_hour,
        track_opens: data.track_opens,
        track_clicks: data.track_clicks,
        unsubscribe_text: data.unsubscribe_text,
      }

      const { data: updated, error } = await supabase
        .from('workspaces')
        .update({
          name: data.name,
          settings: updatedSettings,
        })
        .eq('id', currentWorkspace.id)
        .select()
        .single()

      if (error) throw error

      setCurrentWorkspace(updated)
      toast({ title: 'Settings saved', description: 'Workspace preferences updated successfully.' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSavingWorkspace(false)
    }
  }

  const onSaveProfile = async (data: ProfileForm) => {
    if (!user) return
    setSavingProfile(true)
    try {
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({ full_name: data.full_name })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      setUser(updated)
      toast({ title: 'Profile updated', description: 'Your personal info has been saved.' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground text-sm">
          Configure sending defaults, schedules, email compliance, and personal details.
        </p>
      </div>

      <Tabs defaultValue="workspace" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workspace" className="flex items-center gap-2">
            <Building className="h-4 w-4" /> Workspace Settings
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" /> Personal Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspace">
          <form onSubmit={handleWorkspaceSubmit(onSaveWorkspace)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">General Information</CardTitle>
                <CardDescription>Workspace branding and default time zone.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ws-name">Workspace Name</Label>
                  <Input id="ws-name" {...registerWorkspace('name')} />
                  {wsErrors.name && <p className="text-xs text-destructive">{wsErrors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Default Timezone</Label>
                  <Input id="timezone" {...registerWorkspace('timezone')} placeholder="e.g. America/New_York or UTC" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sending Windows & Safety Limits</CardTitle>
                <CardDescription>
                  Keep deliverability high and prevent spam flags by restricting daily volume.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="daily-limit">Daily Send Cap (Workspace)</Label>
                    <Input id="daily-limit" type="number" {...registerWorkspace('daily_send_limit')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="start-hour">Start Hour (24h)</Label>
                    <Input id="start-hour" type="number" {...registerWorkspace('sending_start_hour')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-hour">End Hour (24h)</Label>
                    <Input id="end-hour" type="number" {...registerWorkspace('sending_end_hour')} />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Track Email Opens</Label>
                      <p className="text-xs text-muted-foreground">Inject lightweight 1x1 tracking pixel</p>
                    </div>
                    <Switch
                      defaultChecked={currentWorkspace?.settings?.track_opens}
                      onCheckedChange={(checked) => setWsValue('track_opens', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Track Link Clicks</Label>
                      <p className="text-xs text-muted-foreground">Rewrite hyperlinks through redirect tracker</p>
                    </div>
                    <Switch
                      defaultChecked={currentWorkspace?.settings?.track_clicks}
                      onCheckedChange={(checked) => setWsValue('track_clicks', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Compliance & Unsubscribe</CardTitle>
                <CardDescription>
                  CAN-SPAM & GDPR compliance footer automatically appended to campaign emails.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="unsub-text">Unsubscribe Notice</Label>
                  <Textarea
                    id="unsub-text"
                    rows={3}
                    {...registerWorkspace('unsubscribe_text')}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Leads clicking unsubscribe are automatically added to suppression lists and stopped from follow-ups.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button type="submit" disabled={savingWorkspace}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Workspace Changes
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>

        <TabsContent value="profile">
          <form onSubmit={handleProfileSubmit(onSaveProfile)}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profile Details</CardTitle>
                <CardDescription>Your personal account credentials.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-email">Email Address</Label>
                  <Input id="profile-email" value={user?.email || ''} disabled className="bg-muted text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Full Name</Label>
                  <Input id="profile-name" {...registerProfile('full_name')} />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button type="submit" disabled={savingProfile}>
                  <Save className="h-4 w-4 mr-2" />
                  Update Profile
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  )
}
