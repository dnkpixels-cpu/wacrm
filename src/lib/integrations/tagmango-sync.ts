import { supabaseAdmin } from '@/lib/flows/admin-client'
import { getVideoCallAttendees, listUpcomingVideoCalls, TagMangoRegistration } from '@/lib/integrations/tagmango'

export async function syncTagMangoAccount(accountId: string) {
  const admin = supabaseAdmin()
  const { data: config, error: configError } = await admin.from('tagmango_configs').select('*').eq('account_id', accountId).eq('enabled', true).maybeSingle()
  if (configError) throw configError
  if (!config) return { accountId, synced: 0, skipped: true }

  const start = new Date()
  const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000)
  const calls = await listUpcomingVideoCalls(config, start, end)
  let synced = 0

  for (const call of calls) {
    if (!call?._id || !call.fromTime) continue
    const startsAt = new Date(call.fromTime)
    if (Number.isNaN(startsAt.getTime())) continue

    const row = {
      account_id: accountId,
      tagmango_session_id: call._id,
      mango_id: call.mango?._id ?? null,
      mango_title: call.mango?.title ?? null,
      title: call.title || call.mango?.title || 'TagMango session',
      starts_at: startsAt.toISOString(),
      ends_at: call.toTime ? new Date(call.toTime).toISOString() : null,
      meeting_url: call.meetingUrl ?? null,
      status: call.status ?? null,
      raw: call,
    }
    const { error } = await admin.from('tagmango_sessions').upsert(row, { onConflict: 'account_id,tagmango_session_id' })
    if (!error) synced += 1
    else console.error('[tagmango/sync] canonical session upsert failed:', error)

    try {
      const now = new Date().toISOString()
      const sessionFields = {
        account_id: accountId,
        session_date: startsAt.toISOString().slice(0, 10),
        start_time: startsAt.toISOString().slice(11, 19),
        session_type: call.title || call.mango?.title || 'TagMango session',
        join_url: call.meetingUrl ?? null,
        status: call.status || 'scheduled',
        source: 'tagmango',
        tagmango_session_id: call._id,
        tagmango_mango_id: call.mango?._id ?? null,
        created_at: now,
        updated_at: now,
      }
      const { data: existing } = await admin.from('sessions').select('id').eq('account_id', accountId).eq('tagmango_session_id', call._id).maybeSingle()
      if (existing?.id) await admin.from('sessions').update(sessionFields).eq('id', existing.id).eq('account_id', accountId)
      else await admin.from('sessions').insert(sessionFields)
    } catch (error) {
      console.warn('[tagmango/sync] legacy session bridge unavailable:', error)
    }
  }

  await admin.from('tagmango_configs').update({ last_sync_at: new Date().toISOString() }).eq('account_id', accountId)
  return { accountId, synced, skipped: false }
}

export async function syncTagMangoSessionRegistrations(accountId: string, videoCallId: string) {
  const admin = supabaseAdmin()
  const { data: config, error: configError } = await admin
    .from('tagmango_configs')
    .select('*')
    .eq('account_id', accountId)
    .eq('enabled', true)
    .maybeSingle()

  if (configError) throw configError
  if (!config) return { accountId, videoCallId, synced: 0, skipped: true }

  const { data: session, error: sessionError } = await admin
    .from('tagmango_sessions')
    .select('id, tagmango_session_id, mango_id')
    .eq('account_id', accountId)
    .eq('tagmango_session_id', videoCallId)
    .maybeSingle()

  if (sessionError) throw sessionError
  if (!session) throw new Error('TagMango session not found for this account.')

  const attendees = await getVideoCallAttendees(config, videoCallId, 1, 100)
  const registrations = attendees.registrations ?? []
  let synced = 0

  for (const registration of registrations as TagMangoRegistration[]) {
    const userId = registration.userId?.trim() || null
    const phone = registration.phone?.trim() || null
    if (!userId && !phone) continue

    const row = {
      account_id: accountId,
      tagmango_session_id: videoCallId,
      mango_id: session.mango_id ?? null,
      tagmango_user_id: userId,
      name: registration.name?.trim() || null,
      email: registration.email?.trim() || null,
      phone,
      timezone: registration.country?.trim() || null,
      raw: registration,
      updated_at: new Date().toISOString(),
    }

    const { error } = await admin
      .from('tagmango_session_registrations')
      .upsert(row, { onConflict: 'account_id,tagmango_session_id,tagmango_user_id,phone' })

    if (error) {
      console.error('[tagmango/registrations] upsert failed:', error)
      continue
    }

    synced += 1
  }

  return {
    accountId,
    videoCallId,
    source: attendees.source ?? null,
    callStatus: attendees.callStatus ?? null,
    total: attendees.total ?? registrations.length,
    filtered: attendees.filtered ?? registrations.length,
    synced,
  }
}
