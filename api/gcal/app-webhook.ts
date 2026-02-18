import { badRequest, methodNotAllowed, notFound, serverError } from '../_utils/http.js';
import { readJson } from '../_utils/http.js';
import { getCalendarClientForConsultant, loadConsultantProfile } from '../_utils/gcal.js';
import { supabaseAdmin } from '../_utils/supabase.js';

const toGoogleRecurrence = (rule?: string | null) => {
  const trimmed = (rule || '').trim();
  if (!trimmed) return null;
  const normalized = trimmed.toUpperCase().startsWith('RRULE:') ? trimmed : `RRULE:${trimmed}`;
  return [normalized];
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const body = await readJson<any>(req);
    const payload = body?.payload || body || {};
    const action = payload?.action;
    const scheduleEventId = payload?.schedule_event_id || payload?.event_id;
    const consultorId = payload?.consultor_id || payload?.consultant_id;

    if (!action || !scheduleEventId) return badRequest(res, 'Payload inválido.');

    const { data: scheduleEvent } = await supabaseAdmin
      .from('schedule_events')
      .select('*')
      .eq('id', scheduleEventId)
      .maybeSingle();

    if (!scheduleEvent) return notFound(res, 'Evento não encontrado.');

    const consultantId = consultorId || scheduleEvent.consultant_id;
    if (!consultantId) return badRequest(res, 'Consultor inválido.');

    const profile = await loadConsultantProfile(consultantId);
    if (!profile?.google_connected || !profile.google_calendar_id) {
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, skipped: true }));
      return;
    }

    const { calendar } = await getCalendarClientForConsultant(consultantId);
    const calendarId = profile.google_calendar_id;

    const descriptionParts = [scheduleEvent.description, scheduleEvent.meeting_url ? `Meeting: ${scheduleEvent.meeting_url}` : null]
      .filter(Boolean)
      .join('\n');
    const recurrence = toGoogleRecurrence(scheduleEvent.recurrence_rule);

    const googleEventPayload = {
      summary: scheduleEvent.title,
      description: descriptionParts || undefined,
      start: {
        dateTime: scheduleEvent.start_at,
        timeZone: scheduleEvent.timezone || 'America/Sao_Paulo',
      },
      end: {
        dateTime: scheduleEvent.end_at,
        timeZone: scheduleEvent.timezone || 'America/Sao_Paulo',
      },
      location: scheduleEvent.location || undefined,
      extendedProperties: {
        private: {
          appEventId: scheduleEvent.id,
        },
      },
      recurrence: recurrence || undefined,
    } as any;

    if (action === 'update' && !recurrence) {
      googleEventPayload.recurrence = [];
    }

    let googleEventId = scheduleEvent.google_event_id || null;
    let googleEtag = scheduleEvent.google_etag || null;

    if (action === 'create') {
      const response = await calendar.events.insert({
        calendarId,
        requestBody: googleEventPayload,
      });
      googleEventId = response.data.id || googleEventId;
      googleEtag = response.data.etag || googleEtag;
    } else if (action === 'update') {
      if (!googleEventId) {
        const response = await calendar.events.insert({
          calendarId,
          requestBody: googleEventPayload,
        });
        googleEventId = response.data.id || googleEventId;
        googleEtag = response.data.etag || googleEtag;
      } else {
        const response = await calendar.events.patch({
          calendarId,
          eventId: googleEventId,
          requestBody: googleEventPayload,
        });
        googleEventId = response.data.id || googleEventId;
        googleEtag = response.data.etag || googleEtag;
      }
    } else if (action === 'cancel') {
      if (googleEventId) {
        await calendar.events.delete({
          calendarId,
          eventId: googleEventId,
        });
      }
    }

    await supabaseAdmin
      .from('schedule_events')
      .update({
        google_event_id: googleEventId,
        google_etag: googleEtag,
        google_calendar_id: calendarId,
        external_origin: 'APP',
      })
      .eq('id', scheduleEventId);

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
  } catch (err: any) {
    console.error(err);
    return serverError(res, 'Erro ao sincronizar com Google Calendar.', err?.message);
  }
}
