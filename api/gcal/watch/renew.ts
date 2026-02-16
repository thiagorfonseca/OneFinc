import { methodNotAllowed, serverError } from '../../_utils/http.js';
import { createWatchChannel, getCalendarClientForConsultant, listExpiringChannels, updateSyncState } from '../../_utils/gcal.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const expiring = await listExpiringChannels(cutoff);

    for (const state of expiring) {
      try {
        const calendarId = state.google_calendar_id;
        if (!calendarId) continue;
        const { calendar } = await getCalendarClientForConsultant(state.consultor_id);
        const watch = await createWatchChannel(calendar, calendarId);
        await updateSyncState(state.consultor_id, {
          google_calendar_id: calendarId,
          channel_id: watch.id || null,
          resource_id: watch.resourceId || null,
          channel_expiration: watch.expiration ? new Date(Number(watch.expiration)).toISOString() : null,
        });
      } catch (err) {
        console.error('Erro ao renovar watch', err);
      }
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, processed: expiring.length }));
  } catch (err: any) {
    console.error(err);
    return serverError(res, 'Erro ao renovar watch.', err?.message);
  }
}
