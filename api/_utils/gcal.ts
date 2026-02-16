import { google } from 'googleapis';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual, randomUUID } from 'crypto';
import { APP_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_SECRET, WEBHOOK_PUBLIC_URL } from './env.js';
import { supabaseAdmin } from './supabase.js';

const TOKEN_SECRET = (GOOGLE_TOKEN_SECRET || GOOGLE_CLIENT_SECRET || '').trim();
const STATE_TTL_MS = 10 * 60 * 1000;

const requireEnv = () => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }
  if (!APP_URL) {
    throw new Error('Missing APP_URL');
  }
  if (!TOKEN_SECRET) {
    throw new Error('Missing GOOGLE_TOKEN_SECRET');
  }
};

const base64UrlEncode = (value: string) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const base64UrlDecode = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = normalized + (pad ? '='.repeat(4 - pad) : '');
  return Buffer.from(padded, 'base64').toString('utf-8');
};

const getKey = () => createHash('sha256').update(TOKEN_SECRET).digest();

export const encryptSecret = (plain: string) => {
  if (!plain) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
};

export const decryptSecret = (payload: string) => {
  if (!payload) return '';
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) return '';
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
};

export const signState = (payload: Record<string, any>) => {
  const base = base64UrlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', TOKEN_SECRET).update(base).digest('hex');
  return `${base}.${sig}`;
};

export const verifyState = (state: string) => {
  const [base, sig] = state.split('.');
  if (!base || !sig) return null;
  const expected = createHmac('sha256', TOKEN_SECRET).update(base).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sig);
  if (expectedBuf.length !== sigBuf.length) return null;
  const ok = timingSafeEqual(expectedBuf, sigBuf);
  if (!ok) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(base));
    if (payload?.ts && Date.now() - payload.ts > STATE_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
};

export const getOAuthClient = () => {
  requireEnv();
  const redirectUri = `${APP_URL.replace(/\/$/, '')}/api/gcal/oauth/callback`;
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
};

export const buildAuthUrl = (state: string) => {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
    state,
  });
};

export const extractCalendarId = (link?: string | null) => {
  if (!link) return null;
  const trimmed = link.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@') && !trimmed.includes('http')) return trimmed;
  try {
    const url = new URL(trimmed);
    const cid = url.searchParams.get('cid');
    const src = url.searchParams.get('src');
    if (cid) {
      try {
        return base64UrlDecode(cid);
      } catch {
        return null;
      }
    }
    if (src) return decodeURIComponent(src);
  } catch {
    // not a url
  }
  const cidMatch = trimmed.match(/cid=([^&]+)/i);
  if (cidMatch?.[1]) {
    try {
      return base64UrlDecode(cidMatch[1]);
    } catch {
      return null;
    }
  }
  const srcMatch = trimmed.match(/src=([^&]+)/i);
  if (srcMatch?.[1]) return decodeURIComponent(srcMatch[1]);
  return null;
};

export const loadConsultantProfile = async (consultorId: string) => {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, clinic_id, google_calendar_link, google_calendar_id, google_connected')
    .eq('id', consultorId)
    .maybeSingle();
  return data || null;
};

const resolveConsultantClinicId = async (consultorId: string, profileClinicId?: string | null) => {
  if (profileClinicId) return profileClinicId;
  const { data } = await supabaseAdmin
    .from('clinic_users')
    .select('clinic_id')
    .eq('user_id', consultorId)
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .maybeSingle();
  return data?.clinic_id || null;
};

export const upsertTokens = async (consultorId: string, tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string | null;
}) => {
  const { data: existing } = await supabaseAdmin
    .from('google_oauth_tokens')
    .select('refresh_token')
    .eq('consultor_id', consultorId)
    .maybeSingle();

  const accessToken = tokens.access_token || '';
  const refreshToken = tokens.refresh_token || (existing?.refresh_token ? decryptSecret(existing.refresh_token) : '');

  await supabaseAdmin
    .from('google_oauth_tokens')
    .upsert({
      consultor_id: consultorId,
      access_token: encryptSecret(accessToken),
      refresh_token: encryptSecret(refreshToken),
      expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      scope: tokens.scope ?? null,
    });

  return { access_token: accessToken, refresh_token: refreshToken, expiry_date: tokens.expiry_date ?? null };
};

export const getTokenRow = async (consultorId: string) => {
  const { data } = await supabaseAdmin
    .from('google_oauth_tokens')
    .select('*')
    .eq('consultor_id', consultorId)
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    access_token: decryptSecret(data.access_token),
    refresh_token: decryptSecret(data.refresh_token),
  };
};

export const getCalendarClientForConsultant = async (consultorId: string) => {
  const tokenRow = await getTokenRow(consultorId);
  if (!tokenRow) throw new Error('Tokens do Google não encontrados.');
  const client = getOAuthClient();
  const expiryMs = tokenRow.expiry_date ? new Date(tokenRow.expiry_date).getTime() : null;
  client.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expiry_date: expiryMs || undefined,
  });

  const needsRefresh = !tokenRow.access_token || (expiryMs ? Date.now() > expiryMs - 60_000 : false);
  if (needsRefresh && tokenRow.refresh_token) {
    const refreshed = await client.refreshAccessToken();
    const creds = refreshed.credentials || {};
    const updatedAccess = creds.access_token || tokenRow.access_token;
    const updatedRefresh = creds.refresh_token || tokenRow.refresh_token;
    const updatedExpiry = creds.expiry_date ?? expiryMs ?? null;
    client.setCredentials({
      access_token: updatedAccess,
      refresh_token: updatedRefresh,
      expiry_date: updatedExpiry || undefined,
    });
    await upsertTokens(consultorId, {
      access_token: updatedAccess,
      refresh_token: updatedRefresh,
      expiry_date: updatedExpiry,
      scope: creds.scope ?? tokenRow.scope ?? null,
    });
  }

  const calendar = google.calendar({ version: 'v3', auth: client });
  return { client, calendar };
};

export const resolveCalendarId = async (calendar: any, candidate?: string | null) => {
  if (candidate) {
    try {
      await calendar.calendars.get({ calendarId: candidate });
      return candidate;
    } catch {
      // ignore
    }
  }
  const list = await calendar.calendarList.list();
  const items = list.data.items || [];
  const primary = items.find((item: any) => item.primary);
  if (primary?.id) return primary.id;
  if (items[0]?.id) return items[0].id;
  return 'primary';
};

export const createWatchChannel = async (calendar: any, calendarId: string) => {
  if (!WEBHOOK_PUBLIC_URL) throw new Error('Missing WEBHOOK_PUBLIC_URL');
  const id = randomUUID();
  const response = await calendar.events.watch({
    calendarId,
    requestBody: {
      id,
      type: 'web_hook',
      address: `${WEBHOOK_PUBLIC_URL.replace(/\/$/, '')}/api/gcal/push/webhook`,
    },
  });
  return response.data;
};

const toIsoSafe = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const syncGoogleEvents = async (params: {
  consultorId: string;
  calendarId: string;
  calendar: any;
  syncToken?: string | null;
}) => {
  const profile = await loadConsultantProfile(params.consultorId);
  const clinicId = await resolveConsultantClinicId(params.consultorId, profile?.clinic_id);
  if (!clinicId) return { nextSyncToken: null };

  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  do {
    const response = await params.calendar.events.list({
      calendarId: params.calendarId,
      singleEvents: true,
      showDeleted: true,
      conferenceDataVersion: 1,
      maxResults: 2500,
      pageToken,
      syncToken: params.syncToken || undefined,
    });
    const items = response.data.items || [];

    for (const event of items) {
      if (!event.id || !event.start || !event.end) continue;
      const appEventId = event.extendedProperties?.private?.appEventId || null;
      if (appEventId) {
        await supabaseAdmin
          .from('schedule_events')
          .update({
            google_event_id: event.id,
            google_etag: event.etag ?? null,
            google_calendar_id: params.calendarId,
          })
          .eq('id', appEventId);
        if (event.status === 'cancelled') {
          await supabaseAdmin
            .from('schedule_events')
            .update({ status: 'cancelled' })
            .eq('id', appEventId);
        }
        continue;
      }

      const startAt = toIsoSafe(event.start.dateTime || event.start.date);
      const endAt = toIsoSafe(event.end.dateTime || event.end.date);
      if (!startAt || !endAt) continue;
      const allDay = Boolean(event.start.date && !event.start.dateTime);
      const status = event.status === 'cancelled' ? 'cancelled' : 'confirmed';
      const attendees = (event.attendees || []).map((att) => ({
        email: att.email || null,
        name: att.displayName || null,
        responseStatus: att.responseStatus || null,
        self: att.self || null,
        organizer: att.organizer || null,
      }));
      const entryPoint = event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')
        || event.conferenceData?.entryPoints?.[0];
      const meetingUrl = event.hangoutLink || entryPoint?.uri || null;

      await supabaseAdmin
        .from('schedule_external_blocks')
        .upsert({
          clinic_id: clinicId,
          consultant_id: params.consultorId,
          start_at: startAt,
          end_at: endAt,
          all_day: allDay,
          summary: event.summary || null,
          description: event.description || null,
          location: event.location || null,
          meeting_url: meetingUrl,
          attendees,
          html_link: event.htmlLink || null,
          status,
          google_event_id: event.id,
          google_updated: event.updated ?? null,
        }, { onConflict: 'google_event_id' });
    }

    pageToken = response.data.nextPageToken || undefined;
    if (response.data.nextSyncToken) nextSyncToken = response.data.nextSyncToken;
  } while (pageToken);

  return { nextSyncToken };
};

export const updateSyncState = async (consultorId: string, payload: {
  google_calendar_id?: string | null;
  sync_token?: string | null;
  channel_id?: string | null;
  resource_id?: string | null;
  channel_expiration?: string | null;
}) => {
  await supabaseAdmin
    .from('calendar_sync_state')
    .upsert({
      consultor_id: consultorId,
      google_calendar_id: payload.google_calendar_id ?? null,
      sync_token: payload.sync_token ?? null,
      channel_id: payload.channel_id ?? null,
      resource_id: payload.resource_id ?? null,
      channel_expiration: payload.channel_expiration ?? null,
    });
};

export const findSyncStateByChannel = async (channelId: string) => {
  const { data } = await supabaseAdmin
    .from('calendar_sync_state')
    .select('*')
    .eq('channel_id', channelId)
    .maybeSingle();
  return data || null;
};

export const listExpiringChannels = async (cutoff: string) => {
  const { data } = await supabaseAdmin
    .from('calendar_sync_state')
    .select('*')
    .lt('channel_expiration', cutoff);
  return data || [];
};
