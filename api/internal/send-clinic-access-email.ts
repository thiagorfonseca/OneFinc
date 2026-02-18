import { readJson, json, methodNotAllowed, badRequest, serverError, unauthorized } from '../_utils/http.js';
import { supabaseAdmin } from '../_utils/supabase.js';
import { APP_BASE_URL, APP_URL, RESEND_API_KEY, RESEND_FROM } from '../_utils/env.js';
import { requireInternalUser } from '../_utils/auth.js';

const normalizeEmail = (value?: string | null) => (value || '').trim().toLowerCase();

const getAppBaseUrl = (req: any) => {
  const base = (APP_BASE_URL || APP_URL || '').trim();
  if (base) return base.replace(/\/+$/, '');
  const proto = (req.headers?.['x-forwarded-proto'] || 'https').toString();
  const host = (req.headers?.['x-forwarded-host'] || req.headers?.host || '').toString();
  if (!host) return '';
  return `${proto}://${host}`.replace(/\/+$/, '');
};

const findUserByEmail = async (email: string) => {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = (data.users || []).find((user) => (user.email || '').toLowerCase() === email);
    if (found) return found;
    if ((data.users || []).length < perPage) return null;
    page += 1;
  }
};

const ensureAuthUser = async (email: string) => {
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
};

const generateMagicLink = async (email: string, redirectTo: string) => {
  const buildLink = async () =>
    supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo,
      },
    });

  let { data, error } = await buildLink();
  if (!error) return data;

  const lower = (error.message || '').toLowerCase();
  if (lower.includes('user not found') || lower.includes('email not found') || lower.includes('not found')) {
    await ensureAuthUser(email);
    const retry = await buildLink();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  return data;
};

const resolveActionLink = (payload: any) =>
  payload?.properties?.action_link || payload?.action_link || payload?.url || null;

const sendResendEmail = async (params: {
  to: string;
  subject: string;
  html: string;
}) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message || 'Falha ao enviar e-mail.');
  }
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const internal = await requireInternalUser(req);
  if (!internal) return unauthorized(res, 'Acesso negado.');

  try {
    const body = await readJson(req);
    const email = normalizeEmail(body?.email);
    const inviteToken = (body?.inviteToken || '').toString().trim();
    const clinicName = (body?.clinicName || '').toString().trim();

    if (!email) return badRequest(res, 'Informe um e-mail válido.');

    const appBase = getAppBaseUrl(req);
    if (!appBase) return badRequest(res, 'Configuração APP_BASE_URL/APP_URL ausente.');

    const redirectPath = inviteToken
      ? `/accept-invite?token=${encodeURIComponent(inviteToken)}`
      : '/';
    const callbackRedirect = `${appBase}/auth/callback?redirectTo=${encodeURIComponent(redirectPath)}`;
    const loginFallback = inviteToken
      ? `${appBase}/login?redirectTo=${encodeURIComponent(redirectPath)}`
      : `${appBase}/login`;

    const linkPayload = await generateMagicLink(email, callbackRedirect);
    const actionLink = resolveActionLink(linkPayload);
    if (!actionLink) throw new Error('Não foi possível gerar o link de acesso.');

    const subject = inviteToken
      ? `Convite de acesso${clinicName ? ` • ${clinicName}` : ''}`
      : `Acesso à plataforma${clinicName ? ` • ${clinicName}` : ''}`;
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2 style="margin:0 0 12px;">${inviteToken ? 'Você recebeu um convite' : 'Seu acesso foi solicitado'}</h2>
        <p style="margin:0 0 14px;">
          Clique no botão abaixo para acessar.
        </p>
        <p style="margin:0 0 16px;">
          <a href="${actionLink}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">
            Acessar agora
          </a>
        </p>
        <p style="margin:0 0 8px;font-size:13px;color:#4b5563;">
          Se o botão não abrir, use este link:
        </p>
        <p style="margin:0 0 10px;font-size:13px;word-break:break-all;">
          <a href="${actionLink}">${actionLink}</a>
        </p>
        <p style="margin:0;font-size:12px;color:#6b7280;">
          Fallback: <a href="${loginFallback}">${loginFallback}</a>
        </p>
      </div>
    `;

    let sentEmail = false;
    if (RESEND_API_KEY && RESEND_FROM) {
      await sendResendEmail({ to: email, subject, html });
      sentEmail = true;
    }

    return json(res, 200, {
      ok: true,
      sentEmail,
      actionLink,
      loginFallback,
      redirectPath,
    });
  } catch (err: any) {
    console.error(err);
    return serverError(res, 'Erro ao gerar/enviar acesso.', err?.message);
  }
}
