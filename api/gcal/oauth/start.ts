import { badRequest, json, methodNotAllowed, unauthorized } from '../../_utils/http.js';
import { buildAuthUrl, loadConsultantProfile, signState } from '../../_utils/gcal.js';
import { isInternalRole, requireInternalUser } from '../../_utils/auth.js';

const getQueryValue = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value) || '';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const consultorId = getQueryValue(req.query?.consultor_id || req.query?.consultant_id);
  const returnTo = getQueryValue(req.query?.return_to || req.query?.redirect_to);
  if (!consultorId) return badRequest(res, 'Informe consultor_id.');

  const internal = await requireInternalUser(req);
  if (!internal) return unauthorized(res, 'Acesso restrito ao time One Doctor.');

  const profile = await loadConsultantProfile(consultorId);
  if (!profile || !isInternalRole(profile.role)) {
    return unauthorized(res, 'Somente usuários do time One Doctor podem conectar o Google Calendar.');
  }
  const safeReturnTo = returnTo && returnTo.startsWith('/') ? returnTo : '';
  const state = signState({
    consultor_id: consultorId,
    clinic_id: profile?.clinic_id ?? null,
    return_to: safeReturnTo || null,
    ts: Date.now(),
  });
  const url = buildAuthUrl(state);
  const accept = String(req.headers?.accept || '');
  const wantsJson = accept.includes('application/json') || req.query?.format === 'json';

  if (wantsJson) {
    return json(res, 200, { url });
  }

  res.statusCode = 302;
  res.setHeader('Location', url);
  res.end();
}
