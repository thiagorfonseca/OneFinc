import { supabase } from './supabase';
import type { Database } from '../src/types/supabase';

type RevenueRow = Database['public']['Tables']['revenues']['Row'];
type RevenueProcedureRow = Database['public']['Tables']['revenue_procedures']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];

export interface CommercialDataset {
  revenues: RevenueRow[];
  revenueProcedures: RevenueProcedureRow[];
  customers: CustomerRow[];
}

export async function fetchCommercialData(params: { clinicId?: string | null; from?: string; to?: string }): Promise<CommercialDataset> {
  const { clinicId, from, to } = params;

  let revQuery = supabase
    .from('revenues')
    .select('*')
    .order('data_competencia', { ascending: true });
  if (clinicId) revQuery = revQuery.eq('clinic_id', clinicId);
  if (from) revQuery = revQuery.gte('data_competencia', from);
  if (to) revQuery = revQuery.lte('data_competencia', to);
  const { data: revenues } = await revQuery;

  const { data: revenueProcedures } = await supabase
    .from('revenue_procedures')
    .select('*');
  const revProcsFiltered = clinicId ? (revenueProcedures || []).filter(rp => rp.clinic_id === clinicId) : (revenueProcedures || []);

  const { data: customers } = await supabase
    .from('customers')
    .select('*');
  const customersFiltered = clinicId ? (customers || []).filter(c => c.clinic_id === clinicId) : (customers || []);

  return {
    revenues: revenues || [],
    revenueProcedures: revProcsFiltered,
    customers: customersFiltered,
  };
}

export function buildRanking(dataset: CommercialDataset) {
  const byCustomer: Record<string, {
    faturamento: number;
    atendimentos: number;
    procedimentos: Set<string>;
    categorias: Set<string>;
    procedimentosCount: number;
    datas: Set<string>;
  }> = {};

  dataset.revenues.forEach((rev) => {
    const name = (rev.paciente || 'Sem nome').trim() || 'Sem nome';
    if (!byCustomer[name]) {
      byCustomer[name] = {
        faturamento: 0,
        atendimentos: 0,
        procedimentos: new Set<string>(),
        categorias: new Set<string>(),
        procedimentosCount: 0,
        datas: new Set<string>(),
      };
    }
    const bucket = byCustomer[name];
    const val = Number(rev.valor_liquido ?? rev.valor ?? 0);
    bucket.faturamento += isFinite(val) ? val : 0;
    bucket.atendimentos += 1;
    if (rev.data_competencia) bucket.datas.add(rev.data_competencia);

    const procs = dataset.revenueProcedures.filter(rp => rp.revenue_id === rev.id);
    procs.forEach((rp) => {
      if (rp.procedimento) bucket.procedimentos.add(rp.procedimento);
      if (rp.categoria) bucket.categorias.add(rp.categoria);
      bucket.procedimentosCount += rp.quantidade || 0;
    });
  });

  return Object.entries(byCustomer).map(([name, data]) => {
    const ticket = data.atendimentos ? data.faturamento / data.atendimentos : 0;
    const recorrencia = data.datas.size;
    return {
      name,
      faturamento: data.faturamento,
      atendimentos: data.atendimentos,
      ticket,
      recorrencia,
      procedimentosCount: data.procedimentosCount,
      procedimentos: Array.from(data.procedimentos),
      categorias: Array.from(data.categorias),
    };
  });
}

export function buildRecurrence(dataset: CommercialDataset, from?: string, to?: string) {
  const visits: Record<string, Set<string>> = {};
  dataset.revenues.forEach((rev) => {
    if (!rev.data_competencia) return;
    if (from && rev.data_competencia < from) return;
    if (to && rev.data_competencia > to) return;
    const name = (rev.paciente || 'Sem nome').trim() || 'Sem nome';
    if (!visits[name]) visits[name] = new Set();
    visits[name].add(rev.data_competencia);
  });

  const rows = Object.entries(visits).map(([name, dates]) => ({
    name,
    atendimentos: dates.size,
    dates: Array.from(dates).sort(),
    status: dates.size > 1 ? 'Recorrente' : 'Não recorrente',
  }));

  const total = rows.length;
  const recorrentes = rows.filter(r => r.atendimentos > 1).length;
  const naoRecorrentes = total - recorrentes;
  const percentual = total ? (recorrentes / total) * 100 : 0;

  return { rows, total, recorrentes, naoRecorrentes, percentual };
}
