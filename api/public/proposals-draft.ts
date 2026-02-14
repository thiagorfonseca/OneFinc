import { readJson, json, methodNotAllowed, badRequest } from '../_utils/http.js';
import { supabaseAdmin } from '../_utils/supabase.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return methodNotAllowed(res, ['POST', 'DELETE']);
  }

  const token = req.query?.token as string;
  if (!token) return badRequest(res, 'Token ausente.');

  const { data: proposal } = await supabaseAdmin
    .from('od_proposals')
    .select('id')
    .eq('public_token', token)
    .maybeSingle();

  if (!proposal) return badRequest(res, 'Proposta inválida.');

  if (req.method === 'DELETE') {
    await supabaseAdmin
      .from('od_proposal_form_drafts')
      .delete()
      .eq('proposal_id', proposal.id);
    return json(res, 200, { ok: true });
  }

  const body = await readJson(req);
  const payload = body?.payload || body?.form || null;
  const step = Number(body?.step) || 1;
  const meta = body?.meta || {};

  if (!payload || typeof payload !== 'object') {
    return badRequest(res, 'Payload inválido.');
  }

  await supabaseAdmin
    .from('od_proposal_form_drafts')
    .upsert(
      {
        proposal_id: proposal.id,
        payload,
        step,
        meta,
      },
      { onConflict: 'proposal_id' }
    );

  return json(res, 200, { ok: true });
}
