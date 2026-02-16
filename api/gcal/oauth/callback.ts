import { badRequest, methodNotAllowed, serverError } from '../../_utils/http.js';
import { APP_URL } from '../../_utils/env.js';
import {
  extractCalendarId,
  getCalendarClientForConsultant,
  getOAuthClient,
  loadConsultantProfile,
  resolveCalendarId,
  upsertTokens,
  updateSyncState,
  verifyState,
  createWatchChannel,
  syncGoogleEvents,
} from '../../_utils/gcal.js';
import { supabaseAdmin } from '../../_utils/supabase.js';

const getQueryValue = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value) || '';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const code = getQueryValue(req.query?.code);
  const stateParam = getQueryValue(req.query?.state);
  if (!code || !stateParam) return badRequest(res, 'Callback inválido.');

  const state = verifyState(stateParam);
  if (!state?.consultor_id) return badRequest(res, 'State inválido.');

  const consultorId = state.consultor_id as string;

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    await upsertTokens(consultorId, {
      access_token: tokens.access_token || undefined,
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.expiry_date || undefined,
      scope: tokens.scope || null,
    });

    const { calendar } = await getCalendarClientForConsultant(consultorId);

    const profile = await loadConsultantProfile(consultorId);
    const candidate = extractCalendarId(profile?.google_calendar_link || profile?.google_calendar_id || null);
    const calendarId = await resolveCalendarId(calendar, candidate);

    await supabaseAdmin
      .from('profiles')
      .update({
        google_calendar_id: calendarId,
        google_connected: true,
      })
      .eq('id', consultorId);

    const watch = await createWatchChannel(calendar, calendarId);
    await updateSyncState(consultorId, {
      google_calendar_id: calendarId,
      channel_id: watch.id || null,
      resource_id: watch.resourceId || null,
      channel_expiration: watch.expiration ? new Date(Number(watch.expiration)).toISOString() : null,
    });

    const syncResult = await syncGoogleEvents({
      consultorId,
      calendarId,
      calendar,
    });
    if (syncResult.nextSyncToken) {
      await updateSyncState(consultorId, {
        google_calendar_id: calendarId,
        sync_token: syncResult.nextSyncToken,
      });
    }

    const redirectBase = (APP_URL || '').replace(/\/$/, '');
    const returnTo = typeof state.return_to === 'string' && state.return_to.startsWith('/') ? state.return_to : '';
    const fallback = '/profile?gcal=connected';
    const redirectPath = returnTo || fallback;
    const redirectUrl = redirectBase ? `${redirectBase}${redirectPath}` : redirectPath;
    res.statusCode = 302;
    res.setHeader('Location', redirectUrl);
    res.end();
  } catch (err: any) {
    console.error(err);
    return serverError(res, 'Erro ao conectar Google Calendar.', err?.message);
  }
}
