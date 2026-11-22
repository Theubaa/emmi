import { supabaseAdmin } from '../lib/supabase.js'

export async function processBounceEvent(workspaceId: string, leadEmail: string, reason = 'bounce') {
  console.log(`[BounceProcessor] Logging bounce for ${leadEmail} in workspace ${workspaceId}`)

  // 1. Add to suppression list
  await supabaseAdmin
    .from('suppression_list')
    .upsert(
      {
        workspace_id: workspaceId,
        email: leadEmail,
        reason: 'bounce',
      },
      { onConflict: 'workspace_id,email' }
    )

  // 2. Mark lead as bounced
  await supabaseAdmin
    .from('leads')
    .update({ bounced: true, status: 'bounced' })
    .eq('workspace_id', workspaceId)
    .eq('email', leadEmail)

  // 3. Halt active campaigns for this lead
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', leadEmail)
    .single()

  if (lead) {
    await supabaseAdmin
      .from('campaign_leads')
      .update({ status: 'bounced', finished_at: new Date().toISOString() })
      .eq('lead_id', lead.id)

    await supabaseAdmin
      .from('sending_queue')
      .update({ status: 'cancelled', last_error: 'Lead bounced' })
      .eq('lead_id', lead.id)
      .eq('status', 'pending')
  }
}
