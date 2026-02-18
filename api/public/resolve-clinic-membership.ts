import { readJson, json, methodNotAllowed, badRequest, notFound, serverError, unauthorized } from '../_utils/http.js';
import { supabaseAdmin } from '../_utils/supabase.js';
import { resolveAuthUser } from '../_utils/auth.js';

const normalizeEmail = (value?: string | null) => (value || '').trim().toLowerCase();

const fetchAuthUser = async (req: any) => {
  const auth = await resolveAuthUser(req);
  if (!auth?.token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(auth.token);
  if (error || !data?.user) return null;
  return data.user;
};

const acceptInvite = async (invite: any, user: { id: string; email: string }) => {
  const inviteEmail = normalizeEmail(invite?.email);
  if (!inviteEmail) throw new Error('Convite inválido: e-mail não encontrado.');
  if (inviteEmail !== normalizeEmail(user.email)) {
    throw new Error('Este convite foi enviado para outro e-mail. Faça login com o e-mail convidado.');
  }

  const { data: existingByEmail } = await supabaseAdmin
    .from('clinic_users')
    .select('*')
    .eq('email', inviteEmail)
    .maybeSingle();

  const payload = {
    clinic_id: invite.clinic_id,
    role: invite.role,
    ativo: true,
    user_id: user.id,
  };

  if (existingByEmail) {
    if (existingByEmail.clinic_id && existingByEmail.clinic_id !== invite.clinic_id) {
      throw new Error('Este e-mail já está vinculado a outra clínica.');
    }
    const { error: updateError, data: updated } = await supabaseAdmin
      .from('clinic_users')
      .update({
        ...payload,
        name: existingByEmail.name || inviteEmail.split('@')[0] || 'Usuário',
      })
      .eq('id', existingByEmail.id)
      .select('*')
      .maybeSingle();
    if (updateError) throw updateError;
    await supabaseAdmin.from('clinic_invites').delete().eq('id', invite.id);
    return updated || existingByEmail;
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('clinic_users')
    .insert({
      ...payload,
      email: inviteEmail,
      name: inviteEmail.split('@')[0] || 'Usuário',
    })
    .select('*')
    .maybeSingle();
  if (insertError) throw insertError;

  await supabaseAdmin.from('clinic_invites').delete().eq('id', invite.id);
  return inserted || null;
};

const linkMembershipByEmail = async (user: { id: string; email: string }) => {
  const email = normalizeEmail(user.email);
  if (!email) return null;

  const { data: byEmail } = await supabaseAdmin
    .from('clinic_users')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  if (!byEmail) return null;

  if (byEmail.user_id && byEmail.user_id === user.id) return byEmail;

  const { data: updated, error } = await supabaseAdmin
    .from('clinic_users')
    .update({ user_id: user.id, ativo: true })
    .eq('id', byEmail.id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return updated || byEmail;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const user = await fetchAuthUser(req);
    if (!user?.id || !user.email) return unauthorized(res, 'Sessão inválida.');

    const body = await readJson(req);
    const inviteToken = (body?.inviteToken || '').toString().trim();

    if (inviteToken) {
      const { data: invite, error } = await supabaseAdmin
        .from('clinic_invites')
        .select('*')
        .eq('token', inviteToken)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (error) throw error;
      if (!invite) return notFound(res, 'Convite inválido ou expirado.');
      const membership = await acceptInvite(invite, { id: user.id, email: user.email });
      return json(res, 200, { ok: true, membership, source: 'invite' });
    }

    const { data: inviteByEmail } = await supabaseAdmin
      .from('clinic_invites')
      .select('*')
      .eq('email', normalizeEmail(user.email))
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inviteByEmail) {
      const membership = await acceptInvite(inviteByEmail, { id: user.id, email: user.email });
      return json(res, 200, { ok: true, membership, source: 'invite-email' });
    }

    const linked = await linkMembershipByEmail({ id: user.id, email: user.email });
    if (!linked) return notFound(res, 'Nenhuma clínica vinculada ao seu e-mail.');
    return json(res, 200, { ok: true, membership: linked, source: 'email-link' });
  } catch (err: any) {
    console.error(err);
    if (err?.message) return badRequest(res, err.message);
    return serverError(res, 'Erro ao vincular clínica.', err?.message);
  }
}
