import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Calendar, Download, Filter, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../src/auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../lib/utils';

const pieColors = ['#2563eb', '#22c55e', '#f97316', '#a855f7', '#0ea5e9', '#ef4444', '#14b8a6', '#f59e0b'];

const formatDateInput = (date: Date) => date.toISOString().split('T')[0];

const parseNumber = (value: string) => {
  if (!value) return 0;
  const cleaned = value.replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getRevenueValue = (rev: any) => {
  const raw = Number(rev?.valor_liquido ?? rev?.valor_bruto ?? rev?.valor ?? 0);
  return Number.isFinite(raw) ? raw : 0;
};

const ProcedureTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-sm text-xs">
      <div className="font-semibold text-gray-700">{label}</div>
      <div className="text-gray-500">Faturamento: {formatCurrency(Number(data?.valor || 0))}</div>
      <div className="text-gray-500">Quantidade: {Number(data?.quantidade || 0)}</div>
    </div>
  );
};

const AttendanceReport: React.FC = () => {
  const { effectiveClinicId: clinicId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenues, setRevenues] = useState<any[]>([]);
  const [revenueProcedures, setRevenueProcedures] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);

  const [dateStart, setDateStart] = useState(() => {
    const now = new Date();
    return formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [dateEnd, setDateEnd] = useState(() => {
    const now = new Date();
    return formatDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  });
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProcedure, setSelectedProcedure] = useState('');
  const [saleProfessionalId, setSaleProfessionalId] = useState('');
  const [execProfessionalId, setExecProfessionalId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [minValue, setMinValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyWithProcedures, setOnlyWithProcedures] = useState(false);
  const [topLimit, setTopLimit] = useState(10);
  const [commissionInput, setCommissionInput] = useState('');
  const [activeTab, setActiveTab] = useState<'attendance' | 'production'>('attendance');

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin.replace(/\/$/, '');
  }, []);

  useEffect(() => {
    const loadBase = async () => {
      if (!clinicId) {
        setCategories([]);
        setProfessionals([]);
        return;
      }

      const [{ data: cats }, { data: pros }] = await Promise.all([
        supabase
          .from('categories')
          .select('id, name, tipo')
          .eq('clinic_id', clinicId)
          .eq('tipo', 'receita')
          .order('name', { ascending: true }),
        supabase
          .from('professionals')
          .select('id, nome, tipo')
          .eq('clinic_id', clinicId)
          .order('nome', { ascending: true }),
      ]);

      setCategories(cats || []);
      setProfessionals(pros || []);
    };

    loadBase();
  }, [clinicId]);

  useEffect(() => {
    const fetchProcedures = async (ids: string[]) => {
      if (!ids.length || !clinicId) return [];
      const chunkSize = 500;
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += chunkSize) {
        chunks.push(ids.slice(i, i + chunkSize));
      }
      const results: any[] = [];
      for (const chunk of chunks) {
        const { data } = await supabase
          .from('revenue_procedures')
          .select('revenue_id, procedimento, categoria, quantidade, valor_cobrado')
          .eq('clinic_id', clinicId)
          .in('revenue_id', chunk);
        if (data?.length) results.push(...data);
      }
      return results;
    };

    const load = async () => {
      if (!clinicId) {
        setRevenues([]);
        setRevenueProcedures([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('revenues')
          .select('id, data_competencia, category_id, valor, valor_bruto, valor_liquido, status, forma_pagamento, sale_professional_id, exec_professional_id, paciente, description')
          .eq('clinic_id', clinicId)
          .order('data_competencia', { ascending: true });
        if (dateStart) query = query.gte('data_competencia', dateStart);
        if (dateEnd) query = query.lte('data_competencia', dateEnd);

        const { data, error: revError } = await query;
        if (revError) throw revError;

        const list = data || [];
        setRevenues(list);

        const ids = list.map((rev) => rev.id).filter(Boolean);
        const procs = await fetchProcedures(ids);
        setRevenueProcedures(procs);
      } catch (err: any) {
        console.error(err);
        setError('Não foi possível carregar os dados do relatório.');
        setRevenues([]);
        setRevenueProcedures([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [clinicId, dateStart, dateEnd]);

  const categoriesMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat: any) => map.set(cat.id, cat.name));
    return map;
  }, [categories]);

  const professionalsMap = useMemo(() => {
    const map = new Map<string, string>();
    professionals.forEach((prof: any) => map.set(prof.id, prof.nome));
    return map;
  }, [professionals]);

  const proceduresByRevenue = useMemo(() => {
    const map = new Map<string, any[]>();
    revenueProcedures.forEach((rp) => {
      if (!rp.revenue_id) return;
      if (!map.has(rp.revenue_id)) map.set(rp.revenue_id, []);
      map.get(rp.revenue_id)?.push(rp);
    });
    return map;
  }, [revenueProcedures]);

  const categoryByRevenue = useMemo(() => {
    const map = new Map<string, string>();
    proceduresByRevenue.forEach((list, revenueId) => {
      const found = list.find((rp) => rp.categoria);
      if (found?.categoria) map.set(revenueId, found.categoria);
    });
    return map;
  }, [proceduresByRevenue]);

  const procedureOptions = useMemo(() => {
    const set = new Set<string>();
    revenueProcedures.forEach((rp) => {
      if (rp.procedimento) set.add(rp.procedimento);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [revenueProcedures]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c: any) => set.add(c.name));
    revenueProcedures.forEach((rp) => {
      if (rp.categoria) set.add(rp.categoria);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categories, revenueProcedures]);

  const paymentOptions = useMemo(() => {
    const set = new Set<string>();
    revenues.forEach((rev) => {
      if (rev.forma_pagamento) set.add(rev.forma_pagamento);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [revenues]);

  const resolveRevenueCategory = (rev: any) => {
    const fromTable = rev.category_id ? categoriesMap.get(rev.category_id) : undefined;
    if (fromTable) return fromTable;
    const fromProc = categoryByRevenue.get(rev.id);
    if (fromProc) return fromProc;
    return 'Sem categoria';
  };

  const revenueIdsWithProcedure = useMemo(() => {
    const set = new Set<string>();
    proceduresByRevenue.forEach((list, revenueId) => {
      if (list.length) set.add(revenueId);
    });
    return set;
  }, [proceduresByRevenue]);

  const revenueIdsByProcedure = useMemo(() => {
    if (!selectedProcedure) return new Set<string>();
    const set = new Set<string>();
    proceduresByRevenue.forEach((list, revenueId) => {
      if (list.some((rp) => rp.procedimento === selectedProcedure)) set.add(revenueId);
    });
    return set;
  }, [proceduresByRevenue, selectedProcedure]);

  const filteredRevenues = useMemo(() => {
    const minVal = parseNumber(minValue);
    const term = searchTerm.trim().toLowerCase();
    return revenues.filter((rev) => {
      if (selectedCategory) {
        const category = resolveRevenueCategory(rev);
        if (category !== selectedCategory) return false;
      }
      if (selectedProcedure && !revenueIdsByProcedure.has(rev.id)) return false;
      if (saleProfessionalId && rev.sale_professional_id !== saleProfessionalId) return false;
      if (execProfessionalId && rev.exec_professional_id !== execProfessionalId) return false;
      if (statusFilter && rev.status !== statusFilter) return false;
      if (paymentFilter && rev.forma_pagamento !== paymentFilter) return false;
      if (minValue && getRevenueValue(rev) < minVal) return false;
      if (onlyWithProcedures && !revenueIdsWithProcedure.has(rev.id)) return false;
      if (term) {
        const haystack = `${rev.paciente || ''} ${rev.description || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [
    revenues,
    selectedCategory,
    selectedProcedure,
    saleProfessionalId,
    execProfessionalId,
    statusFilter,
    paymentFilter,
    minValue,
    onlyWithProcedures,
    searchTerm,
    revenueIdsWithProcedure,
    revenueIdsByProcedure,
    categoriesMap,
    categoryByRevenue,
  ]);

  const filteredRevenueIds = useMemo(() => new Set(filteredRevenues.map((rev) => rev.id)), [filteredRevenues]);

  const filteredProcedures = useMemo(() => {
    return revenueProcedures.filter((rp) => {
      if (!filteredRevenueIds.has(rp.revenue_id)) return false;
      if (selectedProcedure && rp.procedimento !== selectedProcedure) return false;
      return true;
    });
  }, [revenueProcedures, filteredRevenueIds, selectedProcedure]);

  const productionRevenues = useMemo(() => {
    return revenues.filter((rev) => {
      if (saleProfessionalId && rev.sale_professional_id !== saleProfessionalId) return false;
      if (execProfessionalId && rev.exec_professional_id !== execProfessionalId) return false;
      return true;
    });
  }, [revenues, saleProfessionalId, execProfessionalId]);

  const productionRevenueIds = useMemo(
    () => new Set(productionRevenues.map((rev) => rev.id)),
    [productionRevenues]
  );

  const productionProcedures = useMemo(
    () => revenueProcedures.filter((rp) => productionRevenueIds.has(rp.revenue_id)),
    [revenueProcedures, productionRevenueIds]
  );

  const commissionRate = parseNumber(commissionInput);

  const productionRows = useMemo(() => {
    const rows: Array<{
      client: string;
      date: string;
      procedure: string;
      category: string;
      value: number;
      commission: number;
    }> = [];
    const revenueById = new Map<string, any>();
    productionRevenues.forEach((rev) => revenueById.set(rev.id, rev));
    const usedRevenue = new Set<string>();

    productionProcedures.forEach((rp) => {
      const rev = revenueById.get(rp.revenue_id);
      if (!rev) return;
      usedRevenue.add(rev.id);
      const quantity = Number(rp.quantidade || 0) || 1;
      const unit = Number(rp.valor_cobrado || 0);
      const value = unit > 0 ? unit * quantity : getRevenueValue(rev);
      const category = rp.categoria || resolveRevenueCategory(rev);
      const client = rev.paciente || rev.description || 'Sem nome';
      const commission = value * (commissionRate / 100);
      rows.push({
        client,
        date: rev.data_competencia || '',
        procedure: rp.procedimento || 'Atendimento',
        category,
        value,
        commission,
      });
    });

    productionRevenues.forEach((rev) => {
      if (usedRevenue.has(rev.id)) return;
      const value = getRevenueValue(rev);
      const commission = value * (commissionRate / 100);
      rows.push({
        client: rev.paciente || rev.description || 'Sem nome',
        date: rev.data_competencia || '',
        procedure: rev.description || 'Atendimento',
        category: resolveRevenueCategory(rev),
        value,
        commission,
      });
    });

    return rows.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
  }, [productionRevenues, productionProcedures, commissionRate, resolveRevenueCategory]);

  const productionTotals = useMemo(() => {
    return productionRows.reduce(
      (acc, row) => {
        acc.value += row.value;
        acc.commission += row.commission;
        return acc;
      },
      { value: 0, commission: 0 }
    );
  }, [productionRows]);

  const summary = useMemo(() => {
    const totalFaturamento = filteredRevenues.reduce((acc, rev) => acc + getRevenueValue(rev), 0);
    const atendimentos = filteredRevenues.length;
    const ticket = atendimentos ? totalFaturamento / atendimentos : 0;
    const procedimentosCount = filteredProcedures.reduce((acc, rp) => acc + Number(rp.quantidade || 0), 0);
    return { totalFaturamento, atendimentos, ticket, procedimentosCount };
  }, [filteredRevenues, filteredProcedures]);

  const proceduresChart = useMemo(() => {
    const map = new Map<string, { name: string; quantidade: number; valor: number }>();
    filteredProcedures.forEach((rp) => {
      const name = rp.procedimento || 'Sem procedimento';
      if (!map.has(name)) map.set(name, { name, quantidade: 0, valor: 0 });
      const bucket = map.get(name)!;
      const quantidade = Number(rp.quantidade || 0);
      const valorUnit = Number(rp.valor_cobrado || 0);
      bucket.quantidade += quantidade;
      bucket.valor += quantidade * valorUnit;
    });
    return Array.from(map.values())
      .sort((a, b) => b.valor - a.valor)
      .slice(0, topLimit);
  }, [filteredProcedures, topLimit]);

  const categoriesChart = useMemo(() => {
    const map = new Map<string, number>();
    filteredRevenues.forEach((rev) => {
      const category = resolveRevenueCategory(rev);
      const value = getRevenueValue(rev);
      map.set(category, (map.get(category) || 0) + value);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, topLimit);
  }, [filteredRevenues, topLimit, categoriesMap, categoryByRevenue]);

  const salesChart = useMemo(() => {
    const map = new Map<string, number>();
    filteredRevenues.forEach((rev) => {
      const label = rev.sale_professional_id
        ? professionalsMap.get(rev.sale_professional_id) || 'Profissional não encontrado'
        : 'Sem profissional';
      map.set(label, (map.get(label) || 0) + getRevenueValue(rev));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, topLimit);
  }, [filteredRevenues, topLimit, professionalsMap]);

  const execChart = useMemo(() => {
    const map = new Map<string, number>();
    filteredRevenues.forEach((rev) => {
      const label = rev.exec_professional_id
        ? professionalsMap.get(rev.exec_professional_id) || 'Profissional não encontrado'
        : 'Sem profissional';
      map.set(label, (map.get(label) || 0) + getRevenueValue(rev));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, topLimit);
  }, [filteredRevenues, topLimit, professionalsMap]);

  const resetFilters = () => {
    setSelectedCategory('');
    setSelectedProcedure('');
    setSaleProfessionalId('');
    setExecProfessionalId('');
    setStatusFilter('');
    setPaymentFilter('');
    setMinValue('');
    setSearchTerm('');
    setOnlyWithProcedures(false);
  };

  const handleDownloadProductionPdf = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const rowsHtml = productionRows
      .map(
        (row) => `
          <tr>
            <td>${row.client}</td>
            <td>${row.date ? formatDate(row.date) : '-'}</td>
            <td>${row.procedure}</td>
            <td>${row.category}</td>
            <td style="text-align:right;">${formatCurrency(row.value)}</td>
            <td style="text-align:right;">${formatCurrency(row.commission)}</td>
          </tr>`
      )
      .join('');

    const saleName = saleProfessionalId ? professionalsMap.get(saleProfessionalId) || 'Selecionado' : 'Todos';
    const execName = execProfessionalId ? professionalsMap.get(execProfessionalId) || 'Selecionado' : 'Todos';
    const logoPrimary = baseUrl ? `${baseUrl}/logo-onefinc.png` : '';
    const logoSecondary = baseUrl ? `${baseUrl}/onefinc_azul.png` : '';

    win.document.write(`
      <html>
        <head>
          <title>Relatório de Produção Médica</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; }
            .header { display:flex; align-items:center; justify-content:space-between; margin-bottom: 16px; }
            .logos { display:flex; gap:12px; align-items:center; }
            .logos img { height: 36px; }
            h2 { margin: 0 0 4px; }
            .meta { font-size: 12px; color: #6b7280; }
            table { border-collapse: collapse; width: 100%; margin-top: 16px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
            tfoot td { font-weight: bold; background: #f9fafb; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2>Relatório de Produção Médica</h2>
              <div class="meta">Período: ${dateStart || '-'} até ${dateEnd || '-'}</div>
              <div class="meta">Profissional de venda: ${saleName}</div>
              <div class="meta">Profissional de execução: ${execName}</div>
              <div class="meta">Comissão: ${commissionRate ? `${commissionRate}%` : '0%'}</div>
            </div>
            <div class="logos">
              ${logoPrimary ? `<img src="${logoPrimary}" alt="OneFinc" />` : ''}
              ${logoSecondary ? `<img src="${logoSecondary}" alt="OneFinc" />` : ''}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Nome Cliente</th>
                <th>Data</th>
                <th>Procedimento</th>
                <th>Categoria</th>
                <th>Valor</th>
                <th>Valor comissão</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4">Total</td>
                <td style="text-align:right;">${formatCurrency(productionTotals.value)}</td>
                <td style="text-align:right;">${formatCurrency(productionTotals.commission)}</td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  const productionSection = (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Relatório de produção médica</h2>
          <p className="text-sm text-gray-500">Resumo detalhado dos atendimentos realizados.</p>
        </div>
        <button
          type="button"
          onClick={handleDownloadProductionPdf}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          <Download size={16} />
          Baixar PDF
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <span className="text-xs text-gray-400">até</span>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <select
          value={saleProfessionalId}
          onChange={(e) => setSaleProfessionalId(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">Profissional de venda</option>
          {professionals.map((prof: any) => (
            <option key={prof.id} value={prof.id}>
              {prof.nome}
            </option>
          ))}
        </select>
        <select
          value={execProfessionalId}
          onChange={(e) => setExecProfessionalId(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">Profissional de execução</option>
          {professionals.map((prof: any) => (
            <option key={prof.id} value={prof.id}>
              {prof.nome}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Comissão (%)</label>
          <input
            value={commissionInput}
            onChange={(e) => setCommissionInput(e.target.value)}
            placeholder="Ex: 10"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-28"
          />
        </div>
      </div>

      <div className="border border-gray-100 rounded-xl overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">Nome Cliente</th>
              <th className="text-left px-4 py-3">Data</th>
              <th className="text-left px-4 py-3">Procedimento</th>
              <th className="text-left px-4 py-3">Categoria</th>
              <th className="text-right px-4 py-3">Valor</th>
              <th className="text-right px-4 py-3">Valor comissão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {productionRows.map((row, idx) => (
              <tr key={`${row.client}-${row.date}-${row.procedure}-${idx}`}>
                <td className="px-4 py-3 text-gray-800">{row.client}</td>
                <td className="px-4 py-3 text-gray-600">{row.date ? formatDate(row.date) : '-'}</td>
                <td className="px-4 py-3 text-gray-700">{row.procedure}</td>
                <td className="px-4 py-3 text-gray-500">{row.category}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.value)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.commission)}</td>
              </tr>
            ))}
            {productionRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Nenhum atendimento encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
          {productionRows.length > 0 && (
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={4} className="px-4 py-3 font-semibold text-gray-700">Total</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatCurrency(productionTotals.value)}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatCurrency(productionTotals.commission)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Relatório de Atendimento</h1>
            <p className="text-gray-500">Financeiro • Relatório de Atendimento</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2 rounded-lg text-sm border transition ${
              activeTab === 'attendance'
                ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Relatório de Atendimento
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('production')}
            className={`px-4 py-2 rounded-lg text-sm border transition ${
              activeTab === 'production'
                ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Produção médica
          </button>
        </div>
      </div>

      {activeTab === 'attendance' && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mb-3">
            <Filter size={16} />
            <span>Filtros</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <label className="text-sm text-gray-600 flex flex-col gap-1">
              <span className="text-xs text-gray-400 flex items-center gap-2"><Calendar size={14} /> De</span>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2"
              />
            </label>
            <label className="text-sm text-gray-600 flex flex-col gap-1">
              <span className="text-xs text-gray-400 flex items-center gap-2"><Calendar size={14} /> Até</span>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2"
              />
            </label>
            <label className="text-sm text-gray-600 flex flex-col gap-1">
              <span className="text-xs text-gray-400">Categoria</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 bg-white"
              >
                <option value="">Todas</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-600 flex flex-col gap-1">
              <span className="text-xs text-gray-400">Procedimento</span>
              <select
                value={selectedProcedure}
                onChange={(e) => setSelectedProcedure(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 bg-white"
              >
                <option value="">Todos</option>
                {procedureOptions.map((proc) => (
                  <option key={proc} value={proc}>{proc}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-600 flex flex-col gap-1">
              <span className="text-xs text-gray-400">Profissional de venda</span>
              <select
                value={saleProfessionalId}
                onChange={(e) => setSaleProfessionalId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 bg-white"
              >
                <option value="">Todos</option>
                {professionals.map((prof: any) => (
                  <option key={prof.id} value={prof.id}>{prof.nome}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-600 flex flex-col gap-1">
              <span className="text-xs text-gray-400">Profissional de execução</span>
              <select
                value={execProfessionalId}
                onChange={(e) => setExecProfessionalId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 bg-white"
              >
                <option value="">Todos</option>
                {professionals.map((prof: any) => (
                  <option key={prof.id} value={prof.id}>{prof.nome}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-600 flex flex-col gap-1">
              <span className="text-xs text-gray-400">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 bg-white"
              >
                <option value="">Todos</option>
                <option value="paid">Pago</option>
                <option value="pending">Pendente</option>
              </select>
            </label>
            <label className="text-sm text-gray-600 flex flex-col gap-1">
              <span className="text-xs text-gray-400">Forma de pagamento</span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 bg-white"
              >
                <option value="">Todas</option>
                {paymentOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-600 flex flex-col gap-1">
              <span className="text-xs text-gray-400">Valor mínimo</span>
              <input
                type="text"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                placeholder="Ex: 200"
                className="border border-gray-200 rounded-lg px-3 py-2"
              />
            </label>
            <label className="text-sm text-gray-600 flex flex-col gap-1">
              <span className="text-xs text-gray-400">Buscar (paciente ou descrição)</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="border border-gray-200 rounded-lg px-3 py-2"
              />
            </label>
            <label className="text-sm text-gray-600 flex flex-col gap-1">
              <span className="text-xs text-gray-400">Top N</span>
              <select
                value={topLimit}
                onChange={(e) => setTopLimit(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-2 bg-white"
              >
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
                <option value={15}>Top 15</option>
                <option value={20}>Top 20</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={onlyWithProcedures}
                onChange={(e) => setOnlyWithProcedures(e.target.checked)}
              />
              Somente com procedimentos
            </label>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw size={14} />
              Limpar filtros
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 size={18} className="animate-spin" />
          Carregando relatório...
        </div>
      ) : activeTab === 'attendance' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Faturamento</p>
              <p className="text-2xl font-semibold text-gray-800 mt-1">{formatCurrency(summary.totalFaturamento)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Atendimentos</p>
              <p className="text-2xl font-semibold text-gray-800 mt-1">{summary.atendimentos}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Ticket médio</p>
              <p className="text-2xl font-semibold text-gray-800 mt-1">{formatCurrency(summary.ticket)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Procedimentos</p>
              <p className="text-2xl font-semibold text-gray-800 mt-1">{summary.procedimentosCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-base font-semibold text-gray-800 mb-3">Procedimentos (Top {topLimit})</h3>
              {proceduresChart.length === 0 ? (
                <div className="text-sm text-gray-400">Sem dados para exibir.</div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={proceduresChart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<ProcedureTooltip />} />
                      <Bar dataKey="valor" name="Valor" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-base font-semibold text-gray-800 mb-3">Categoria (Top {topLimit})</h3>
              {categoriesChart.length === 0 ? (
                <div className="text-sm text-gray-400">Sem dados para exibir.</div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoriesChart}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={4}
                      >
                        {categoriesChart.map((entry, index) => (
                          <Cell key={`cell-${entry.name}`} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-base font-semibold text-gray-800 mb-3">Faturamento por profissional de venda</h3>
              {salesChart.length === 0 ? (
                <div className="text-sm text-gray-400">Sem dados para exibir.</div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesChart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="value" name="Faturamento" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-base font-semibold text-gray-800 mb-3">Faturamento por profissional de execução</h3>
              {execChart.length === 0 ? (
                <div className="text-sm text-gray-400">Sem dados para exibir.</div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={execChart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="value" name="Faturamento" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        productionSection
      )}
    </div>
  );
};

export default AttendanceReport;
