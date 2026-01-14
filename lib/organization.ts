import { supabase } from './supabase';
import { UserRole } from '../types';

export async function inviteUserToClinic(params: { clinic_id: string; email: string; role: UserRole; invited_by: string; expires_at?: string }) {
  const token = crypto.randomUUID();
  const expires_at = params.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const email = params.email.trim().toLowerCase();
  const { error } = await (supabase as any).from('clinic_invites').insert({
    clinic_id: params.clinic_id,
    email,
    role: params.role,
    invited_by: params.invited_by,
    token,
    expires_at,
  });
  if (error) throw error;
  return token;
}

export async function listMembers(clinic_id: string) {
  const { data, error } = await supabase
    .from('clinic_users')
    .select('id, email, name, role, ativo, created_at, clinic_id')
    .eq('clinic_id', clinic_id);
  if (error) throw error;
  return data;
}

export async function updateMemberRole(id: string, role: UserRole) {
  const { error } = await supabase.from('clinic_users').update({ role }).eq('id', id);
  if (error) throw error;
}

export async function revokeMember(id: string) {
  const { error } = await supabase.from('clinic_users').update({ ativo: false }).eq('id', id);
  if (error) throw error;
}

export async function acceptInvite(token: string, _user_id: string) {
  const { data: invite, error } = await (supabase as any)
    .from('clinic_invites')
    .select('*')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!invite) throw new Error('Convite inválido ou expirado');

  const inviteEmail = (invite as any).email?.trim().toLowerCase();
  const { error: joinError } = await supabase.from('clinic_users').insert({
    clinic_id: (invite as any).clinic_id,
    email: inviteEmail,
    name: inviteEmail?.split('@')[0] || 'Usuário',
    role: (invite as any).role,
    ativo: true,
    user_id: _user_id,
  });
  if (joinError) throw joinError;

  await (supabase as any).from('clinic_invites').delete().eq('id', (invite as any).id);
  return invite;
}
