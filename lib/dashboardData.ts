import { supabase } from './supabase';
import type { Database } from '../src/types/supabase';

type RevenueRow = Database['public']['Tables']['revenues']['Row'];
type ExpenseRow = Database['public']['Tables']['expenses']['Row'];

export interface DreResult {
  revenues: RevenueRow[];
  expenses: ExpenseRow[];
}

export interface CashflowResult {
  revenues: RevenueRow[];
  expenses: ExpenseRow[];
}

type Params = { clinicId?: string | null; from: string; to: string; isAdmin: boolean };

export async function getDreSummary({ clinicId, from, to, isAdmin }: Params): Promise<DreResult> {
  let revQuery = supabase
    .from('revenues')
    .select('*')
    .gte('data_competencia', from)
    .lte('data_competencia', to)
    .eq('status', 'paid');
  let expQuery = supabase
    .from('expenses')
    .select('*')
    .gte('data_competencia', from)
    .lte('data_competencia', to)
    .eq('status', 'paid');

  if (!isAdmin && clinicId) {
    revQuery = revQuery.eq('clinic_id', clinicId);
    expQuery = expQuery.eq('clinic_id', clinicId);
  } else if (isAdmin && clinicId) {
    revQuery = revQuery.eq('clinic_id', clinicId);
    expQuery = expQuery.eq('clinic_id', clinicId);
  }

  const [{ data: revenues }, { data: expenses }] = await Promise.all([revQuery, expQuery]);
  return { revenues: revenues || [], expenses: expenses || [] };
}

export async function getCashflowSummary({ clinicId, from, to, isAdmin }: Params): Promise<CashflowResult> {
  let revQuery = supabase
    .from('revenues')
    .select('*')
    .gte('data_recebimento', from)
    .lte('data_recebimento', to)
    .eq('status', 'paid');
  let expQuery = supabase
    .from('expenses')
    .select('*')
    .gte('data_pagamento', from)
    .lte('data_pagamento', to)
    .eq('status', 'paid');

  if (!isAdmin && clinicId) {
    revQuery = revQuery.eq('clinic_id', clinicId);
    expQuery = expQuery.eq('clinic_id', clinicId);
  } else if (isAdmin && clinicId) {
    revQuery = revQuery.eq('clinic_id', clinicId);
    expQuery = expQuery.eq('clinic_id', clinicId);
  }

  const [{ data: revenues }, { data: expenses }] = await Promise.all([revQuery, expQuery]);
  return { revenues: revenues || [], expenses: expenses || [] };
}
