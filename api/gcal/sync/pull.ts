import { badRequest, methodNotAllowed, serverError, unauthorized } from '../../_utils/http.js';
import { readJson } from '../../_utils/http.js';
import { findSyncStateByChannel, getCalendarClientForConsultant, syncGoogleEvents, updateSyncState } from '../../_utils/gcal.js';
import { isInternalRole, requireInternalUser } from '../../_utils/auth.js';
import { supabaseAdmin } from '../../_utils/supabase.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const internal = await requireInternalUser(req);
  if (!internal) return unauthorized(res, 'Acesso restrito ao time One Doctor.');

  try {
    const body = await readJson<any>(req);
    const channelId = body?.channel_id || req.query?.channel_id;
    const consultorId = body?.consultor_id || req.query?.consultor_id;

    let syncState = null as any;
    if (channelId) {
      syncState = await findSyncStateByChannel(String(channelId));
    }
    if (!syncState && consultorId) {
      const { data } = await supabaseAdmin
        .from('calendar_sync_state')
        .select('*')
        .eq('consultor_id', String(consultorId))
        .maybeSingle();
      syncState = data || null;
    }

    if (!syncState) return badRequest(res, 'Sync state não encontrado.');
    const { data: consultantProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', syncState.consultor_id)
      .maybeSingle();
    if (!isInternalRole(consultantProfile?.role)) {
      return unauthorized(res, 'Sincronização Google permitida apenas para usuários One Doctor.');
    }

    const { calendar } = await getCalendarClientForConsultant(syncState.consultor_id);
    const calendarId = syncState.google_calendar_id || null;
    if (!calendarId) return badRequest(res, 'Calendar ID não encontrado.');

    let syncToken = syncState.sync_token || null;
    let nextSyncToken: string | null = null;

    try {
      const result = await syncGoogleEvents({
        consultorId: syncState.consultor_id,
        calendarId,
        calendar,
        syncToken,
      });
      nextSyncToken = result.nextSyncToken || null;
    } catch (err: any) {
      const status = err?.code || err?.response?.status;
      if (status === 410) {
        syncToken = null;
        const result = await syncGoogleEvents({
          consultorId: syncState.consultor_id,
          calendarId,
          calendar,
          syncToken: null,
        });
        nextSyncToken = result.nextSyncToken || null;
      } else {
        throw err;
      }
    }

    if (nextSyncToken) {
      await updateSyncState(syncState.consultor_id, {
        google_calendar_id: calendarId,
        sync_token: nextSyncToken,
      });
    }

    await supabaseAdmin
      .from('profiles')
      .update({ last_google_sync_at: new Date().toISOString() })
      .eq('id', syncState.consultor_id);

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
  } catch (err: any) {
    console.error(err);
    return serverError(res, 'Erro ao sincronizar.', err?.message);
  }
}
