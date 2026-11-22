import { supabaseAdmin } from '../lib/supabase.js'
import { createImapClient, fetchNewEmails } from '../lib/imap.js'
import { decryptCredential } from '../lib/crypto.js'

export async function runImapSyncForAccount(accountId: string) {
  const { data: account } = await supabaseAdmin
    .from('email_accounts')
    .select('*, credentials:email_account_credentials(*), sync_state:email_sync_states(*)')
    .eq('id', accountId)
    .single()

  if (!account || !account.sync_enabled) return

  let password = ''
  if (account.credentials?.[0]?.encrypted_data) {
    try {
      password = decryptCredential(account.credentials[0].encrypted_data)
    } catch (e: any) {
      console.warn(`[ImapSync] Could not decrypt password for ${account.email}`)
      return
    }
  }

  const client = createImapClient({
    host: account.imap_host || 'imap.gmail.com',
    port: account.imap_port || 993,
    secure: account.imap_encryption === 'ssl',
    auth: {
      user: account.email,
      pass: password,
    },
  })

  const lastUid = account.sync_state?.[0]?.last_uid || 0

  try {
    const emails = await fetchNewEmails(client, lastUid)
    console.log(`[ImapSync] Fetched ${emails.length} new emails for ${account.email}`)

    let maxUid = lastUid

    for (const email of emails) {
      if (email.uid > maxUid) maxUid = email.uid

      // Threading logic: find existing conversation by inReplyTo or references
      let matchedConvId: string | null = null

      if (email.inReplyTo || (email.references && email.references.length > 0)) {
        const refList = [email.inReplyTo, ...(email.references || [])].filter(Boolean)
        const { data: matchedMsg } = await supabaseAdmin
          .from('email_messages')
          .select('conversation_id')
          .in('message_id', refList)
          .eq('workspace_id', account.workspace_id)
          .limit(1)
          .single()

        if (matchedMsg) {
          matchedConvId = matchedMsg.conversation_id
        }
      }

      // If no thread match, check for open conversation with this sender email
      if (!matchedConvId) {
        const { data: lead } = await supabaseAdmin
          .from('leads')
          .select('id')
          .eq('workspace_id', account.workspace_id)
          .eq('email', email.from.address)
          .single()

        if (lead) {
          const { data: leadConv } = await supabaseAdmin
            .from('conversations')
            .select('id')
            .eq('workspace_id', account.workspace_id)
            .eq('lead_id', lead.id)
            .single()

          if (leadConv) {
            matchedConvId = leadConv.id
          }
        }
      }

      // If still no conversation, create new one
      if (!matchedConvId) {
        const { data: newConv } = await supabaseAdmin
          .from('conversations')
          .insert({
            workspace_id: account.workspace_id,
            email_account_id: account.id,
            subject: email.subject,
            status: 'open',
            is_read: false,
            last_message_at: email.date.toISOString(),
          })
          .select('id')
          .single()

        matchedConvId = newConv?.id || null
      }

      if (matchedConvId) {
        // Insert message
        await supabaseAdmin
          .from('email_messages')
          .insert({
            conversation_id: matchedConvId,
            workspace_id: account.workspace_id,
            email_account_id: account.id,
            message_id: email.messageId,
            in_reply_to: email.inReplyTo || null,
            references: email.references || [],
            direction: 'inbound',
            from_email: email.from.address || '',
            from_name: email.from.name || null,
            to_emails: email.to,
            subject: email.subject,
            body_text: email.bodyText || null,
            body_html: email.bodyHtml || null,
            sent_at: email.date.toISOString(),
            is_read: false,
          })
          .select()

        // Update conversation last message timestamp & unread status
        await supabaseAdmin
          .from('conversations')
          .update({
            last_message_at: email.date.toISOString(),
            is_read: false,
            status: 'replied',
          })
          .eq('id', matchedConvId)
      }
    }

    // Update sync state
    await supabaseAdmin.from('email_sync_states').upsert(
      {
        email_account_id: account.id,
        last_uid: maxUid,
        last_sync_completed_at: new Date().toISOString(),
        status: 'idle',
      },
      { onConflict: 'email_account_id' }
    )

    await supabaseAdmin
      .from('email_accounts')
      .update({ last_sync_at: new Date().toISOString(), status: 'connected' })
      .eq('id', account.id)
  } catch (err: any) {
    console.error(`[ImapSync] Error syncing account ${account.email}:`, err.message)
    await supabaseAdmin
      .from('email_accounts')
      .update({ error_message: err.message, status: 'error' })
      .eq('id', account.id)
  }
}

export async function runAllImapSyncs() {
  const { data: accounts } = await supabaseAdmin
    .from('email_accounts')
    .select('id')
    .eq('sync_enabled', true)

  if (!accounts || accounts.length === 0) return

  for (const acc of accounts) {
    await runImapSyncForAccount(acc.id)
  }
}
