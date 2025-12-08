import React, { useEffect, useState, useMemo } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts';
import { ArrowUpCircle, ArrowDownCircle, Wallet, Loader2, Calendar } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { supabase } from '../lib/supabase';
import {
  gerarParcelasDeCaixa,
  gerarFluxoDiario,
  gerarFluxoMensal,
  aplicarSaldoAcumulado,
  Lancamento,
  ParcelaCaixa,
} from '../lib/cashflow';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cashParcels, setCashParcels] = useState<ParcelaCaixa[]>([]);
  const [incomesRaw, setIncomesRaw] = useState<any[]>([]);
  const [expensesRaw, setExpensesRaw] = useState<any[]>([]);
  const [dateStart, setDateStart] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [dateEnd, setDateEnd] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));

  // Buscar dados reais do Supabase
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // 1. Buscar todas as Receitas
      const { data: incomes } = await supabase
        .from('revenues')
        .select('id, description, valor_liquido, valor_bruto, data_competencia, data_recebimento, forma_pagamento, parcelas, status, categories(name), bank_account_id');

      // 2. Buscar todas as Despesas
      const { data: expenses } = await supabase
        .from('expenses')
        .select('id, description, valor, data_competencia, data_pagamento, forma_pagamento, parcelas, status, categories(name), bank_account_id');

        // 3. Buscar Contas Bancárias (para saldo atual)
        const { data: bankAccs } = await supabase
          .from('bank_accounts')
          .select('current_balance');

        setAccounts(bankAccs || []);
        setIncomesRaw(incomes || []);
        setExpensesRaw(expenses || []);

      // -------- Fluxo de Caixa Inteligente --------
      const parseDate = (d?: string | null) => (d ? new Date(d) : undefined);
        const mapForma = (f?: string | null) => {
          const t = (f || '').toUpperCase();
          if (t.includes('CRED')) return 'CREDITO';
          if (t.includes('DEB')) return 'DEBITO';
          if (t.includes('PIX')) return 'PIX';
          if (t.includes('BOLE')) return 'BOLETO';
          if (t.includes('CONV')) return 'CONVENIO';
          if (t.includes('DIN')) return 'DINHEIRO';
          return 'OUTRO';
        };

        const lancamentos: Lancamento[] = [];

        (incomes || []).forEach((i: any) => {
          const dataEmissao = parseDate(i.data_competencia);
          if (!dataEmissao) return;
          lancamentos.push({
            id: i.id,
            tipo: 'RECEITA',
            descricao: i.description || 'Receita',
            dataEmissao,
            dataVencimento: parseDate(i.data_recebimento),
            formaPagamento: mapForma(i.forma_pagamento),
            valorTotal: i.valor_liquido || i.valor_bruto || 0,
            numeroParcelas: parseInt(i.parcelas || 1, 10),
            status: i.status === 'paid' ? 'REALIZADO' : 'PREVISTO',
            dataBaixa: parseDate(i.data_recebimento),
          });
        });

        (expenses || []).forEach((e: any) => {
          const dataEmissao = parseDate(e.data_competencia);
          if (!dataEmissao) return;
          lancamentos.push({
            id: e.id,
            tipo: 'DESPESA',
            descricao: e.description || 'Despesa',
            dataEmissao,
            dataVencimento: parseDate(e.data_pagamento),
            formaPagamento: mapForma(e.forma_pagamento),
            valorTotal: e.valor || 0,
            numeroParcelas: parseInt(e.parcelas || 1, 10),
            status: e.status === 'paid' ? 'REALIZADO' : 'PREVISTO',
            dataBaixa: parseDate(e.data_pagamento),
          });
        });

        const parcelas = gerarParcelasDeCaixa(lancamentos);
        setCashParcels(parcelas);

      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const withinRange = (d?: string | Date | null) => {
    if (!d) return false;
    const dt = d instanceof Date ? d : new Date(d);
    return dt >= dateStart && dt <= dateEnd;
  };

  const balance = useMemo(() => accounts.reduce((acc, curr) => acc + (curr.current_balance || 0), 0), [accounts]);

  const pieData = useMemo(() => {
    const catDataMap = new Map();
    expensesRaw
      .filter((e: any) => withinRange(e.data_pagamento || e.data_competencia))
      .forEach((e: any) => {
        const name = e.categories?.name || 'Outros';
        catDataMap.set(name, (catDataMap.get(name) || 0) + (e.valor || 0));
      });
    return Array.from(catDataMap.entries()).map(([name, value]) => ({ name, value }));
  }, [expensesRaw, dateStart, dateEnd]);

  const COLORS = ['#0ea5e9', '#ef4444', '#eab308', '#a855f7', '#f97316', '#10b981'];

  // Faturamento (emitido) e despesas por vencimento (DRE) no período selecionado
  const totalReceitaDRE = useMemo(() => {
    return incomesRaw
      .filter((i: any) => withinRange(i.data_competencia))
      .reduce((acc, i: any) => acc + (i.valor_liquido || i.valor_bruto || 0), 0);
  }, [incomesRaw, dateStart, dateEnd]);

  const totalDespesaDRE = useMemo(() => {
    return expensesRaw
      .filter((e: any) => withinRange(e.data_pagamento || e.data_competencia))
      .reduce((acc, e: any) => acc + (e.valor || 0), 0);
  }, [expensesRaw, dateStart, dateEnd]);

  const parcelasFiltradas = useMemo(() => {
    return cashParcels.filter((p) => withinRange(p.dataPrevista));
  }, [cashParcels, dateStart, dateEnd]);

  const fluxoDiarioFiltrado = useMemo(() => {
    const diario = gerarFluxoDiario(parcelasFiltradas);
    const saldoInicial = (accounts || []).reduce((acc: number, a: any) => acc + (a.current_balance || 0), 0);
    return aplicarSaldoAcumulado(diario, saldoInicial);
  }, [parcelasFiltradas, accounts]);

  const recebimentoPrevisto = useMemo(
    () => parcelasFiltradas.filter((p) => p.tipo === 'RECEITA').reduce((acc, p) => acc + p.valor, 0),
    [parcelasFiltradas]
  );

  const pagamentoPrevisto = useMemo(
    () => parcelasFiltradas.filter((p) => p.tipo === 'DESPESA').reduce((acc, p) => acc + p.valor, 0),
    [parcelasFiltradas]
  );
  const fluxoMensal = useMemo(() => gerarFluxoMensal(parcelasFiltradas), [parcelasFiltradas]);

  const setPresetRange = (preset: 'today' | 'week' | 'month' | 'year') => {
    const now = new Date();
    if (preset === 'today') {
      setDateStart(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
      setDateEnd(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    } else if (preset === 'week') {
      const start = new Date(now);
      const end = new Date(now);
      end.setDate(end.getDate() + 6);
      setDateStart(start);
      setDateEnd(end);
    } else if (preset === 'month') {
      setDateStart(new Date(now.getFullYear(), now.getMonth(), 1));
      setDateEnd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    } else {
      setDateStart(new Date(now.getFullYear(), 0, 1));
      setDateEnd(new Date(now.getFullYear(), 11, 31));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-400">
        <Loader2 size={48} className="animate-spin mb-4 text-brand-500" />
        <p>Carregando indicadores financeiros...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Visão Geral</h1>
        <p className="text-gray-500">Resumo financeiro em tempo real</p>
      </div>

      {/* Filtros de período */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setPresetRange('today')} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Dia</button>
          <button onClick={() => setPresetRange('week')} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Semana</button>
          <button onClick={() => setPresetRange('month')} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Mês</button>
          <button onClick={() => setPresetRange('year')} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Ano</button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateStart.toISOString().split('T')[0]}
              onChange={(e) => setDateStart(new Date(e.target.value))}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
          <span className="text-gray-400">até</span>
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateEnd.toISOString().split('T')[0]}
              onChange={(e) => setDateEnd(new Date(e.target.value))}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Saldo em Contas</p>
            <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(balance)}</h3>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
            <Wallet size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Total Receitas (DRE)</p>
            <h3 className="text-2xl font-bold text-green-600">{formatCurrency(totalReceitaDRE)}</h3>
          </div>
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600">
            <ArrowUpCircle size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Total Despesas (por vencimento)</p>
            <h3 className="text-2xl font-bold text-red-600">{formatCurrency(totalDespesaDRE)}</h3>
          </div>
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600">
            <ArrowDownCircle size={24} />
          </div>
        </div>
      </div>

      {/* Diferença Faturamento (emitido) vs Caixa previsto do mês */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100">
          <p className="text-xs text-gray-500">Faturamento emitido (mês)</p>
          <p className="text-xl font-bold text-gray-800">{formatCurrency(totalReceitaDRE)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100">
          <p className="text-xs text-gray-500">Recebimento previsto (mês)</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(recebimentoPrevisto)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100">
          <p className="text-xs text-gray-500">Pagamento previsto (mês)</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(pagamentoPrevisto)}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Flow Chart - Saldo previsto diário */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Fluxo de Caixa (Saldo Previsto)</h3>
          <div className="h-72">
            {fluxoDiarioFiltrado.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fluxoDiarioFiltrado.map(d => ({
                  data: d.data.toISOString().split('T')[0],
                  saldo: d.saldoAcumulado,
                }))}>
                  <defs>
                    <linearGradient id="saldoColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="data" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `R$${(val/1000).toFixed(1)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="saldo" stroke="#0ea5e9" strokeWidth={2} dot={false} fillOpacity={1} fill="url(#saldoColor)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                Nenhuma previsão no período.
              </div>
            )}
          </div>
        </div>

      {/* Expenses Breakdown */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">Despesas por Categoria</h3>
        <div className="h-72 flex items-center justify-center">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name || `cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-400 text-sm">
                Sem despesas para exibir gráfico.
              </div>
            )}
        </div>
      </div>
    </div>

      {/* Fluxo previsto diário (período selecionado) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Fluxo Previsto (período)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2 text-right">Receitas</th>
                <th className="px-4 py-2 text-right">Despesas</th>
                <th className="px-4 py-2 text-right">Saldo do Dia</th>
                <th className="px-4 py-2 text-right">Saldo Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fluxoDiarioFiltrado.map((d: any) => (
                <tr key={d.data.toString()} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{d.data.toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2 text-right text-green-600 font-medium">{formatCurrency(d.totalReceitasPrevistas)}</td>
                  <td className="px-4 py-2 text-right text-red-600 font-medium">{formatCurrency(d.totalDespesasPrevistas)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatCurrency(d.saldoPrevistoDia)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatCurrency(d.saldoAcumulado)}</td>
                </tr>
              ))}
              {fluxoDiarioFiltrado.length === 0 && (
                <tr><td colSpan={5} className="text-center py-4 text-gray-400">Sem previsões registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fluxo previsto mensal (período selecionado) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Fluxo Previsto (mensal)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2">Competência</th>
                <th className="px-4 py-2 text-right">Receitas</th>
                <th className="px-4 py-2 text-right">Despesas</th>
                <th className="px-4 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fluxoMensal.map((m: any) => (
                <tr key={`${m.ano}-${m.mes}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{String(m.mes).padStart(2, '0')}/{m.ano}</td>
                  <td className="px-4 py-2 text-right text-green-600 font-medium">{formatCurrency(m.totalReceitasPrevistas)}</td>
                  <td className="px-4 py-2 text-right text-red-600 font-medium">{formatCurrency(m.totalDespesasPrevistas)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatCurrency(m.saldoPrevistoMes)}</td>
                </tr>
              ))}
              {fluxoMensal.length === 0 && (
                <tr><td colSpan={4} className="text-center py-4 text-gray-400">Sem previsões mensais.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
