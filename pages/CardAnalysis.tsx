import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Filter, Calendar, RefreshCw } from 'lucide-react';

type Period = 'dia' | 'semana' | 'quinzenal' | 'mes' | 'ano';

interface RevenueRow {
  id: string;
  data_competencia: string;
  valor_bruto: number;
  valor_liquido: number;
  forma_pagamento: string;
}

const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const getRange = (period: Period) => {
  const today = new Date();
  const end = today.toISOString().split('T')[0];
  const start = new Date(today);
  switch (period) {
    case 'dia':
      break;
    case 'semana':
      start.setDate(today.getDate() - 7);
      break;
    case 'quinzenal':
      start.setDate(today.getDate() - 15);
      break;
    case 'mes':
      start.setMonth(today.getMonth() - 1);
      break;
    case 'ano':
      start.setFullYear(today.getFullYear() - 1);
      break;
  }
  return { start: start.toISOString().split('T')[0], end };
};

const settlementDate = (rev: RevenueRow) => {
  const base = rev.data_competencia;
  if (rev.forma_pagamento?.toLowerCase().includes('débito') || rev.forma_pagamento?.toLowerCase().includes('debito')) {
    return addDays(base, 1);
  }
  if (rev.forma_pagamento?.toLowerCase().includes('crédito') || rev.forma_pagamento?.toLowerCase().includes('credito')) {
    return addDays(base, 30);
  }
  if (rev.forma_pagamento?.toLowerCase().includes('pix') || rev.forma_pagamento?.toLowerCase().includes('dinheiro') || rev.forma_pagamento?.toLowerCase().includes('transfer')) {
    return base;
  }
  return base;
};

const CardAnalysis: React.FC = () => {
  const [revenues, setRevenues] = useState<RevenueRow[]>([]);
  const [period, setPeriod] = useState<Period>('mes');
  const [dateStart, setDateStart] = useState(getRange('mes').start);
  const [dateEnd, setDateEnd] = useState(getRange('mes').end);

  const fetchData = async () => {
    try {
      let query = supabase.from('revenues').select('id, data_competencia, valor_bruto, valor_liquido, forma_pagamento');
      if (dateStart) query = query.gte('data_competencia', dateStart);
      if (dateEnd) query = query.lte('data_competencia', dateEnd);
      const { data, error } = await query;
      if (error) throw error;
      setRevenues((data || []) as any);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const { start, end } = getRange(period);
    setDateStart(start);
    setDateEnd(end);
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [dateStart, dateEnd]);

  const vendasPorDia = useMemo(() => {
    const map = new Map<string, { data: string; bruto: number; liquido: number }>();
    revenues.forEach(r => {
      const key = r.data_competencia;
      const item = map.get(key) || { data: key, bruto: 0, liquido: 0 };
      item.bruto += Number(r.valor_bruto || 0);
      item.liquido += Number(r.valor_liquido || 0);
      map.set(key, item);
    });
    return Array.from(map.values()).sort((a, b) => a.data.localeCompare(b.data));
  }, [revenues]);

  const recebiveisFuturos = useMemo(() => {
    const map = new Map<string, { data: string; liquido: number }>();
    revenues.forEach(r => {
      const recebedata = settlementDate(r);
      const item = map.get(recebedata) || { data: recebedata, liquido: 0 };
      item.liquido += Number(r.valor_liquido || 0);
      map.set(recebedata, item);
    });
    return Array.from(map.values()).sort((a, b) => a.data.localeCompare(b.data));
  }, [revenues]);

  const totais = useMemo(() => {
    const vendidoBruto = revenues.reduce((s, r) => s + Number(r.valor_bruto || 0), 0);
    const vendidoLiquido = revenues.reduce((s, r) => s + Number(r.valor_liquido || 0), 0);
    // Receber no período (usando data de liquidação dentro do filtro)
    const receberPeriodo = revenues.reduce((s, r) => {
      const liqDate = settlementDate(r);
      if (liqDate >= dateStart && liqDate <= dateEnd) {
        return s + Number(r.valor_liquido || 0);
      }
      return s;
    }, 0);
    return { vendidoBruto, vendidoLiquido, receberPeriodo };
  }, [revenues, dateStart, dateEnd]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Análise de Cartão</h1>
          <p className="text-gray-500">Compare vendas e recebíveis considerando taxas e prazos de cartão.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['dia','semana','quinzenal','mes','ano'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-2 rounded-lg text-sm border ${period === p ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
            >
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
          <button
            onClick={fetchData}
            className="px-3 py-2 border border-gray-200 rounded-lg text-gray-700 flex items-center gap-2"
          >
            <RefreshCw size={16}/> Atualizar
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Calendar size={16}/></span>
              <input
                type="date"
                value={dateStart}
                onChange={e => setDateStart(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <span className="text-gray-400">até</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Calendar size={16}/></span>
              <input
                type="date"
                value={dateEnd}
                onChange={e => setDateEnd(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <div>
              <p className="text-gray-500">Vendido (bruto)</p>
              <p className="text-lg font-semibold text-gray-800">{formatCurrency(totais.vendidoBruto)}</p>
            </div>
            <div>
              <p className="text-gray-500">Vendido (líquido c/ taxa)</p>
              <p className="text-lg font-semibold text-gray-800">{formatCurrency(totais.vendidoLiquido)}</p>
            </div>
            <div>
              <p className="text-gray-500">A receber no período</p>
              <p className="text-lg font-semibold text-emerald-700">{formatCurrency(totais.receberPeriodo)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3 text-gray-700 font-semibold">
            <Filter size={16}/> Vendas por data (bruto x líquido)
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendasPorDia}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" tickFormatter={d => d.slice(5)} />
                <YAxis />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={formatDate} />
                <Bar dataKey="bruto" fill="#94a3b8" name="Bruto" />
                <Bar dataKey="liquido" fill="#0ea5e9" name="Líquido (c/ taxa)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3 text-gray-700 font-semibold">
            <Filter size={16}/> Recebíveis futuros (líquido)
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recebiveisFuturos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" tickFormatter={d => d.slice(5)} />
                <YAxis />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={formatDate} />
                <Bar dataKey="liquido" fill="#22c55e" name="Líquido a receber" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardAnalysis;
