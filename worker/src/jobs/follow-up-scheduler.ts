import { supabaseAdmin } from '../lib/supabase.js'
import { emailSendingQueue, SendEmailJobData } from '../lib/queue.js'

function interpolateVariables(template: string, vars: Record<string, string | null | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '')
}

function isWithinSendingSchedule(campaign: any): boolean {
  const days = campaign.sending_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const startHour = campaign.sending_start_hour ?? 9
  const endHour = campaign.sending_end_hour ?? 18

  const now = new Date()
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getUTCDay()]
  const currentHour = now.getUTCHours()

  if (!days.includes(dayName)) return false
  if (currentHour < startHour || currentHour >= endHour) return false

  return true
}

export async function runFollowUpScheduler() {
  console.log('[Scheduler] Running follow-up and sequence progression check...')

  // 1. Fetch active campaigns
  const { data: activeCampaigns } = await supabaseAdmin
    .from('campaigns')
    .select('*, sequences:campaign_sequences(*)')
    .eq('status', 'active')

  if (!activeCampaigns || activeCampaigns.length === 0) return

  for (const campaign of activeCampaigns) {
    if (!isWithinSendingSchedule(campaign)) {
      continue
    }

    // 2. Fetch available sending accounts for this campaign's workspace
    const { data: accounts } = await supabaseAdmin
      .from('email_accounts')
      .select('*')
      .eq('workspace_id', campaign.workspace_id)
      .eq('status', 'connected')

    if (!accounts || accounts.length === 0) continue

    // 3. Find campaign leads that are due for next step
    const { data: eligibleLeads } = await supabaseAdmin
      .from('campaign_leads')
      .select('*, lead:leads(*)')
      .eq('campaign_id', campaign.id)
      .in('status', ['pending', 'active'])
      .or(`next_send_at.is.null,next_send_at.lte.${new Date().toISOString()}`)
      .limit(campaign.daily_send_limit || 50)

    if (!eligibleLeads || eligibleLeads.length === 0) continue

    const sequences = (campaign.sequences || []).sort((a: any, b: any) => a.step_number - b.step_number)

    for (const cl of eligibleLeads) {
      if (!cl.lead || cl.lead.unsubscribed || cl.lead.bounced) {
        await supabaseAdmin
          .from('campaign_leads')
          .update({ status: 'completed', finished_at: new Date().toISOString() })
          .eq('id', cl.id)
        continue
      }

      const nextStepIndex = cl.current_step
      const targetStep = sequences[nextStepIndex]

      if (!targetStep) {
        // Sequence completed for this lead
        await supabaseAdmin
          .from('campaign_leads')
          .update({ status: 'completed', finished_at: new Date().toISOString() })
          .eq('id', cl.id)
        continue
      }

      // Pick round-robin email account
      const sendingAccount = accounts[Math.floor(Math.random() * accounts.length)]

      // Personalize content
      const vars: Record<string, string | null | undefined> = {
        first_name: cl.lead.first_name,
        last_name: cl.lead.last_name,
        company: cl.lead.company,
        email: cl.lead.email,
        job_title: cl.lead.job_title,
      }

      const subject = interpolateVariables(targetStep.subject, vars)
      const bodyText = interpolateVariables(targetStep.body_text, vars)
      let bodyHtml = interpolateVariables(targetStep.body_html, vars)

      // Insert into sending_queue table
      const scheduledAt = new Date().toISOString()
      const { data: queueItem } = await supabaseAdmin
        .from('sending_queue')
        .insert({
          workspace_id: campaign.workspace_id,
          campaign_id: campaign.id,
          campaign_lead_id: cl.id,
          sequence_step_id: targetStep.id,
          email_account_id: sendingAccount.id,
          lead_id: cl.lead_id,
          scheduled_at: scheduledAt,
          status: 'pending',
        })
        .select('id')
        .single()

      // Calculate next step delay
      const nextStep = sequences[nextStepIndex + 1]
      let nextSendAt: string | null = null
      if (nextStep) {
        const delayMs = (nextStep.delay_days * 24 + nextStep.delay_hours) * 60 * 60 * 1000
        nextSendAt = new Date(Date.now() + delayMs).toISOString()
      }

      // Update campaign lead progress
      await supabaseAdmin
        .from('campaign_leads')
        .update({
          status: 'active',
          current_step: nextStepIndex + 1,
          next_send_at: nextSendAt,
          email_account_id: sendingAccount.id,
        })
        .eq('id', cl.id)

      // Push to BullMQ queue
      const jobData: SendEmailJobData = {
        queueItemId: queueItem?.id,
        workspaceId: campaign.workspace_id,
        campaignId: campaign.id,
        campaignLeadId: cl.id,
        sequenceStepId: targetStep.id,
        emailAccountId: sendingAccount.id,
        leadId: cl.lead_id,
        toEmail: cl.lead.email,
        fromName: campaign.from_name || sendingAccount.display_name,
        fromEmail: sendingAccount.email,
        subject,
        bodyHtml,
        bodyText,
      }

      await emailSendingQueue.add('send-campaign-step', jobData)
      console.log(`[Scheduler] Queued step ${targetStep.step_number} for lead ${cl.lead.email}`)
    }
  }
}
