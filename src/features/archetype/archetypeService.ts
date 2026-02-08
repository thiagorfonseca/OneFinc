import { supabase } from '../../../lib/supabase';
import type { ArchetypeAnswer, ArchetypeRespondentRow, ArchetypeScores, PublicLinkRow, PublicTokenResolution } from './types';

const normalizeScores = (scores: any): ArchetypeScores => {
  return {
    FACILITADOR: Number(scores?.FACILITADOR ?? 0) || 0,
    ANALISTA: Number(scores?.ANALISTA ?? 0) || 0,
    REALIZADOR: Number(scores?.REALIZADOR ?? 0) || 0,
    VISIONÁRIO: Number(scores?.VISIONÁRIO ?? 0) || 0,
  };
};

export const resolvePublicToken = async (token: string): Promise<PublicTokenResolution | null> => {
  const { data, error } = await supabase
    .from('archetype_public_links')
    .select('clinic_id, audience_type, is_active')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) return null;
  return data as PublicTokenResolution;
};

export const submitRespondent = async (payload: {
  clinic_id: string;
  public_token: string;
  audience_type: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  profession?: string | null;
  city?: string | null;
  consent_lgpd: boolean;
  scores: Record<string, number>;
  top_profile: string;
  top_profiles?: string[] | null;
  answers: ArchetypeAnswer[];
}) => {
  const { answers, ...respondent } = payload;
  const { data: created, error } = await supabase
    .from('archetype_respondents')
    .insert([respondent])
    .select('id')
    .single();
  if (error || !created?.id) throw error || new Error('Erro ao salvar respondente.');

  const answerRows = answers.map((answer) => ({
    clinic_id: respondent.clinic_id,
    respondent_id: created.id,
    question_id: answer.questionId,
    selected_word: answer.selectedWord,
    scored_profile: answer.scoredProfile,
  }));
  const { error: answersError } = await supabase.from('archetype_answers').insert(answerRows);
  if (answersError) {
    await supabase.from('archetype_respondents').delete().eq('id', created.id);
    throw answersError;
  }

  return created.id as string;
};

export const fetchRespondents = async (filters: {
  clinicId: string;
  dateFrom?: string;
  dateTo?: string;
  topProfile?: string;
  audienceType?: string;
  search?: string;
  token?: string;
}) => {
  let query = supabase
    .from('archetype_respondents')
    .select('*')
    .eq('clinic_id', filters.clinicId)
    .order('created_at', { ascending: false });

  if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00`);
  if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
  if (filters.topProfile) query = query.eq('top_profile', filters.topProfile);
  if (filters.audienceType) query = query.eq('audience_type', filters.audienceType);
  if (filters.token) query = query.eq('public_token', filters.token);
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`name.ilike.${term},email.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row: any) => ({
    ...row,
    scores: normalizeScores(row.scores),
  })) as ArchetypeRespondentRow[];
};

export const fetchRespondentDetail = async (id: string, clinicId: string) => {
  const { data, error } = await supabase
    .from('archetype_respondents')
    .select('*, archetype_answers (question_id, selected_word, scored_profile)')
    .eq('clinic_id', clinicId)
    .eq('id', id)
    .single();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    scores: normalizeScores((data as any).scores),
  };
};

export const listPublicLinks = async (clinicId: string) => {
  const { data, error } = await supabase
    .from('archetype_public_links')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as PublicLinkRow[];
};

export const createPublicLink = async (payload: {
  clinic_id: string;
  token: string;
  audience_type: string;
  created_by_user_id?: string | null;
}) => {
  const { data, error } = await supabase.from('archetype_public_links').insert([payload]).select('*').single();
  if (error) throw error;
  return data as PublicLinkRow;
};

export const togglePublicLink = async (id: string, isActive: boolean) => {
  const { data, error } = await supabase
    .from('archetype_public_links')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as PublicLinkRow;
};
