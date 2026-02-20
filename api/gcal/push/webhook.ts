import { methodNotAllowed } from '../../_utils/http.js';
import { findSyncStateByChannel, getCalendarClientForConsultant, syncGoogleEvents, updateSyncState } from '../../_utils/gcal.js';
import { supabaseAdmin } from '../../_utils/supabase.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const channelId = req.headers['x-goog-channel-id'] as string | undefined;
  const resourceId = req.headers['x-goog-resource-id'] as string | undefined;

  if (!channelId) {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    const syncState = await findSyncStateByChannel(channelId);
    if (!syncState) {
      res.statusCode = 200;
      res.end();
      return;
    }
    if (resourceId && syncState.resource_id && resourceId !== syncState.resource_id) {
      res.statusCode = 200;
      res.end();
      return;
    }

    const { calendar } = await getCalendarClientForConsultant(syncState.consultor_id);
    const calendarId = syncState.google_calendar_id || null;
    if (!calendarId) {
      res.statusCode = 200;
      res.end();
      return;
    }

    let nextSyncToken: string | null = null;
    try {
      const syncResult = await syncGoogleEvents({
        consultorId: syncState.consultor_id,
        calendarId,
        calendar,
        syncToken: syncState.sync_token || null,
      });
      nextSyncToken = syncResult.nextSyncToken || null;
    } catch (err: any) {
      const status = err?.code || err?.response?.status;
      if (status === 410) {
        const syncResult = await syncGoogleEvents({
          consultorId: syncState.consultor_id,
          calendarId,
          calendar,
          syncToken: null,
        });
        nextSyncToken = syncResult.nextSyncToken || null;
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
    res.end();
  } catch (err) {
    console.error(err);
    res.statusCode = 200;
    res.end();
  }
}
