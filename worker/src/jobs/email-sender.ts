import { Worker, Job } from 'bullmq'
import { redisConnection, SendEmailJobData } from '../lib/queue.js'
import { supabaseAdmin } from '../lib/supabase.js'
import { createSmtpTransporter, sendEmailViaSmtp } from '../lib/smtp.js'
import { decryptCredential } from '../lib/crypto.js'

export function startEmailSenderWorker() {
  const worker = new Worker<SendEmailJobData>(
    'email-sending',
    async (job: Job<SendEmailJobData>) => {
      const data = job.data
      console.log(`[EmailSender] Processing job ${job.id} to: ${data.toEmail}`)

      // 1. Check suppression list
      const { data: suppressed } = await supabaseAdmin
        .from('suppression_list')
        .select('id')
        .eq('workspace_id', data.workspaceId)
        .eq('email', data.toEmail)
        .single()

      if (suppressed) {
        console.warn(`[EmailSender] Recipient ${data.toEmail} is on suppression list. Skipping send.`)
        if (data.queueItemId) {
          await supabaseAdmin
            .from('sending_queue')
            .update({ status: 'cancelled', last_error: 'Suppressed recipient' })
            .eq('id', data.queueItemId)
        }
        return { status: 'suppressed' }
      }

      // 2. Fetch email account credentials
      const { data: account, error: accError } = await supabaseAdmin
        .from('email_accounts')
        .select('*, credentials:email_account_credentials(*)')
        .eq('id', data.emailAccountId)
        .single()

      if (accError || !account) {
        throw new Error(`Email account ${data.emailAccountId} not found`)
      }

      // Check daily limit
      if (account.emails_sent_today >= account.daily_send_limit) {
        throw new Error(`Account ${account.email} has exceeded daily send limit of ${account.daily_send_limit}`)
      }

      let password = ''
      if (account.credentials?.[0]?.encrypted_data) {
        try {
          password = decryptCredential(account.credentials[0].encrypted_data)
        } catch (e: any) {
          console.warn(`[EmailSender] Could not decrypt credentials: ${e.message}`)
        }
      }

      const transporter = createSmtpTransporter({
        host: account.smtp_host || 'smtp.gmail.com',
        port: account.smtp_port || 587,
        secure: account.smtp_encryption === 'ssl',
        user: account.email,
        pass: password,
      })

      // 3. Send email via SMTP
      const generatedMessageId = `<emmil-${Date.now()}-${Math.random().toString(36).substring(2)}@${account.email.split('@')[1] || 'emmil.app'}>`

      const sendResult = await sendEmailViaSmtp(transporter, {
        from: `"${data.fromName || account.display_name || ''}" <${account.email}>`,
        to: data.toEmail,
        subject: data.subject,
        text: data.bodyText,
        html: data.bodyHtml,
        messageId: generatedMessageId,
        inReplyTo: data.inReplyTo,
        references: data.references,
      })

      console.log(`[EmailSender] SMTP accepted for ${data.toEmail}. Response: ${sendResult.response}`)

      // 4. Update sending_queue item
      if (data.queueItemId) {
        await supabaseAdmin
          .from('sending_queue')
          .update({ status: 'sent', updated_at: new Date().toISOString() })
          .eq('id', data.queueItemId)
      }

      // 5. Update emails sent counters
      await supabaseAdmin
        .from('email_accounts')
        .update({ emails_sent_today: account.emails_sent_today + 1 })
        .eq('id', account.id)

      await supabaseAdmin.rpc('increment_campaign_sent', {
        c_id: data.campaignId,
      }).catch(async () => {
        // Fallback direct update
        const { data: camp } = await supabaseAdmin.from('campaigns').select('emails_sent').eq('id', data.campaignId).single()
        if (camp) {
          await supabaseAdmin.from('campaigns').update({ emails_sent: (camp.emails_sent || 0) + 1 }).eq('id', data.campaignId)
        }
      })

      // 6. Record in email_messages for conversation thread
      // Find or create conversation
      let convId: string | null = null
      const { data: existingConv } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('workspace_id', data.workspaceId)
        .eq('lead_id', data.leadId)
        .single()

      if (existingConv) {
        convId = existingConv.id
        await supabaseAdmin
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', convId)
      } else {
        const { data: newConv } = await supabaseAdmin
          .from('conversations')
          .insert({
            workspace_id: data.workspaceId,
            email_account_id: data.emailAccountId,
            lead_id: data.leadId,
            campaign_id: data.campaignId,
            subject: data.subject,
            status: 'open',
            is_read: true,
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .single()
        convId = newConv?.id || null
      }

      if (convId) {
        await supabaseAdmin.from('email_messages').insert({
          conversation_id: convId,
          workspace_id: data.workspaceId,
          email_account_id: data.emailAccountId,
          message_id: generatedMessageId,
          direction: 'outbound',
          from_email: account.email,
          from_name: data.fromName || account.display_name,
          to_emails: [data.toEmail],
          subject: data.subject,
          body_text: data.bodyText,
          body_html: data.bodyHtml,
          sent_at: new Date().toISOString(),
        })
      }

      // 7. Log event in email_events
      await supabaseAdmin.from('email_events').insert({
        workspace_id: data.workspaceId,
        campaign_id: data.campaignId,
        lead_id: data.leadId,
        event_type: 'sent',
        metadata: {
          message_id: generatedMessageId,
          smtp_response: sendResult.response,
        },
      })

      return { success: true, messageId: generatedMessageId }
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  )

  worker.on('failed', async (job, err) => {
    console.error(`[EmailSender] Job ${job?.id} failed:`, err.message)
    if (job?.data?.queueItemId) {
      await supabaseAdmin
        .from('sending_queue')
        .update({ status: 'failed', last_error: err.message, attempts: job.attemptsMade })
        .eq('id', job.data.queueItemId)
    }
  })

  return worker
}
