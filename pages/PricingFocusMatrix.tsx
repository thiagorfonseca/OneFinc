import React, { useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../src/auth/AuthProvider';
import { useModalControls } from '../hooks/useModalControls';

const PricingFocusMatrix: React.FC = () => {
  const { effectiveClinicId: clinicId } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [procedureUsage, setProcedureUsage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mapa' | 'analise'>('mapa');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [showLogicModal, setShowLogicModal] = useState(false);

  const [hoursAvailableInput] = useState('120');
  const [occupancyInput] = useState('50');
  const [taxInput] = useState('15');
  const [marginInput] = useState('20');
  const [cardFeeInput] = useState('2,5');
  const [commissionInput] = useState('20');
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [visibleBuckets, setVisibleBuckets] = useState({
    estrela: true,
    vaca: true,
    abacaxi: true,
  });

  const parseNumber = (value: string) => {
    const raw = value.trim().replace(/[^0-9,.-]/g, '');
    if (!raw) return 0;
    const hasComma = raw.includes(',');
    const normalized = hasComma ? raw.replace(/\./g, '').replace(',', '.') : raw;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  };

  const parsePercent = (value: string) => parseNumber(value) / 100;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let expQuery = supabase.from('pricing_expenses').select('*').order('created_at', { ascending: false });
        let procQuery = supabase.from('procedures').select('*').order('created_at', { ascending: false });
        let usageQuery = supabase
          .from('revenue_procedures')
          .select('procedimento, quantidade, revenues!inner(id, clinic_id)');
        if (clinicId) {
          expQuery = expQuery.eq('clinic_id', clinicId);
          procQuery = procQuery.eq('clinic_id', clinicId);
          usageQuery = usageQuery.eq('revenues.clinic_id', clinicId);
        }
        if (dateStart) {
          const startIso = new Date(`${dateStart}T00:00:00`).toISOString();
          usageQuery = usageQuery.gte('revenues.created_at', startIso);
        }
        if (dateEnd) {
          const endIso = new Date(`${dateEnd}T23:59:59`).toISOString();
          usageQuery = usageQuery.lte('revenues.created_at', endIso);
        }
        const [{ data: expData }, { data: procData }, { data: usageData }] = await Promise.all([
          expQuery,
          procQuery,
          usageQuery,
        ]);
        setExpenses(expData || []);
        setProcedures(procData || []);
        setProcedureUsage(usageData || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [clinicId, dateStart, dateEnd]);

  const totalCosts = useMemo(() => {
    return expenses.reduce((acc, item) => {
      const val = Number(item.valor_calculado ?? item.valor_base ?? 0);
      return acc + (Number.isFinite(val) ? val : 0);
    }, 0);
  }, [expenses]);

  const hoursAvailable = parseNumber(hoursAvailableInput);
  const occupancyRate = parsePercent(occupancyInput);
  const taxRate = parsePercent(taxInput);
  const marginRate = parsePercent(marginInput);
  const cardRate = parsePercent(cardFeeInput);
  const commissionRate = parsePercent(commissionInput);
  const totalRates = taxRate + marginRate + cardRate + commissionRate;

  const costPerHour = useMemo(() => {
    const denom = hoursAvailable * (occupancyRate || 0);
    if (!denom) return 0;
    return totalCosts / denom;
  }, [totalCosts, hoursAvailable, occupancyRate]);

  const classifyProcedure = (rentability: number, durationHours: number) => {
    if (!costPerHour || !durationHours) return { type: 'vaca', percent: 0 };
    const profitPerHour = rentability / durationHours;
    const percentOfCostHour = (profitPerHour / costPerHour) * 100;
    if (percentOfCostHour < 0) return { type: 'abacaxi', percent: percentOfCostHour };
    if (percentOfCostHour <= 50) return { type: 'vaca', percent: percentOfCostHour };
    return { type: 'estrela', percent: percentOfCostHour };
  };

  const typeIcon = (type: 'estrela' | 'vaca' | 'abacaxi') => {
    if (type === 'estrela') return '⭐';
    if (type === 'abacaxi') return '🍍';
    return '🐄';
  };

  const points = useMemo(() => {
    return procedures.map((p) => {
      const durationMinutes = Number(p.tempo_minutos ?? 0);
      const durationHours = durationMinutes ? durationMinutes / 60 : 0;
      const insumo = Number(p.custo_insumo ?? 0);
      const serviceCost = costPerHour * durationHours + insumo;
      const divisor = 1 - totalRates;
      const recommended = divisor > 0 ? serviceCost / divisor : 0;
      const worked = Number(p.valor_cobrado ?? 0);
      const baseValue = worked || recommended;
      const rentability = baseValue - serviceCost;
      const classification = classifyProcedure(rentability, durationHours);
      return {
        id: p.id,
        name: p.procedimento || 'Procedimento',
        x: durationHours,
        y: rentability,
        recommended,
        worked,
        type: classification.type,
        percent: classification.percent,
      };
    });
  }, [procedures, costPerHour, totalRates]);

  const normalizeName = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const realizedMap = useMemo(() => {
    const map = new Map<string, number>();
    procedureUsage.forEach((row) => {
      const raw = row?.procedimento || row?.procedure || '';
      if (!raw) return;
      const key = normalizeName(String(raw));
      const qty = Number(row?.quantidade ?? 1);
      const prev = map.get(key) || 0;
      map.set(key, prev + (Number.isFinite(qty) && qty > 0 ? qty : 1));
    });
    return map;
  }, [procedureUsage]);

  const realizedPoints = useMemo(() => {
    return points.map((p) => {
      const key = normalizeName(p.name || '');
      const realizedCount = realizedMap.get(key) || 0;
      return { ...p, realizedCount };
    });
  }, [points, realizedMap]);

  const realizedTotals = useMemo(() => {
    const totals = { total: 0, estrela: 0, vaca: 0, abacaxi: 0 };
    realizedPoints.forEach((p) => {
      const count = Number(p.realizedCount || 0);
      if (!count) return;
      totals.total += count;
      if (p.type === 'estrela') totals.estrela += count;
      if (p.type === 'vaca') totals.vaca += count;
      if (p.type === 'abacaxi') totals.abacaxi += count;
    });
    return totals;
  }, [realizedPoints]);

  const efficiencyScore = useMemo(() => {
    if (!realizedTotals.total) return 0;
    const score =
      (realizedTotals.estrela * 1 + realizedTotals.vaca * 0.3 - realizedTotals.abacaxi * 0.6) /
      realizedTotals.total;
    return Math.max(0, Math.min(1, score)) * 100;
  }, [realizedTotals]);

  const topOpportunities = useMemo(() => {
    const starsLowRealized = realizedPoints
      .filter((p) => p.type === 'estrela')
      .sort((a, b) => (a.realizedCount || 0) - (b.realizedCount || 0))
      .slice(0, 3);
    const painPoints = realizedPoints
      .filter((p) => p.type !== 'estrela')
      .sort((a, b) => (b.realizedCount || 0) - (a.realizedCount || 0))
      .slice(0, 3);
    return { starsLowRealized, painPoints };
  }, [realizedPoints]);

  const chartModalControls = useModalControls({
    isOpen: isChartExpanded,
    onClose: () => setIsChartExpanded(false),
  });
  const logicModalControls = useModalControls({
    isOpen: showLogicModal,
    onClose: () => setShowLogicModal(false),
  });

  useEffect(() => {
    if (tab !== 'mapa' && isChartExpanded) {
      setIsChartExpanded(false);
    }
  }, [tab, isChartExpanded]);

  const buckets = useMemo(() => {
    const estrela: any[] = [];
    const vaca: any[] = [];
    const abacaxi: any[] = [];
    points.forEach((p) => {
      if (p.type === 'abacaxi') {
        abacaxi.push(p);
        return;
      }
      if (p.type === 'estrela') {
        estrela.push(p);
      } else {
        vaca.push(p);
      }
    });
    return { estrela, vaca, abacaxi };
  }, [points]);

  const filteredBuckets = useMemo(() => {
    return {
      estrela: visibleBuckets.estrela ? buckets.estrela : [],
      vaca: visibleBuckets.vaca ? buckets.vaca : [],
      abacaxi: visibleBuckets.abacaxi ? buckets.abacaxi : [],
    };
  }, [buckets, visibleBuckets]);

  const toggleBucket = (bucket: keyof typeof visibleBuckets) => {
    setVisibleBuckets((prev) => ({ ...prev, [bucket]: !prev[bucket] }));
  };

  const bucketStyles = {
    estrela: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    vaca: 'bg-blue-50 text-blue-700 border-blue-200',
    abacaxi: 'bg-red-50 text-red-700 border-red-200',
  } as const;

  const bucketButtonClass = (active: boolean, bucket: keyof typeof bucketStyles) =>
    `px-3 py-1 rounded-full text-xs font-semibold border transition ${
      active ? bucketStyles[bucket] : 'bg-white text-gray-500 border-gray-200'
    }`;

  const renderBucketFilters = () => (
    <div className="absolute right-3 top-3 z-10 flex flex-wrap gap-2 bg-white/90 backdrop-blur px-3 py-2 rounded-full border border-gray-200 shadow-sm">
      <button
        type="button"
        onClick={() => toggleBucket('estrela')}
        aria-pressed={visibleBuckets.estrela}
        className={bucketButtonClass(visibleBuckets.estrela, 'estrela')}
      >
        Estrela
      </button>
      <button
        type="button"
        onClick={() => toggleBucket('vaca')}
        aria-pressed={visibleBuckets.vaca}
        className={bucketButtonClass(visibleBuckets.vaca, 'vaca')}
      >
        Vaca leiteira
      </button>
      <button
        type="button"
        onClick={() => toggleBucket('abacaxi')}
        aria-pressed={visibleBuckets.abacaxi}
        className={bucketButtonClass(visibleBuckets.abacaxi, 'abacaxi')}
      >
        Abacaxi
      </button>
    </div>
  );

  const TooltipContent = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-md">
        <div className="font-semibold text-gray-900">
          <span className="mr-1">{typeIcon(data.type)}</span>
          {data.name}
        </div>
        <div className="mt-1 space-y-1">
          <div>Horas: {Number(data.x || 0).toFixed(2)}</div>
          <div>Rentabilidade: {formatCurrency(Number(data.y || 0))}</div>
          <div>% custo hora: {Number(data.percent || 0).toFixed(1)}%</div>
          <div>Valor recomendado: {formatCurrency(Number(data.recommended || 0))}</div>
          {data.worked ? <div>Valor cobrado: {formatCurrency(Number(data.worked || 0))}</div> : null}
        </div>
      </div>
    );
  };

  const exportAnalysisPdf = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const percent = (value: number) => `${value.toFixed(1)}%`;
    const starsPercent = realizedTotals.total ? (realizedTotals.estrela / realizedTotals.total) * 100 : 0;
    const vacaPercent = realizedTotals.total ? (realizedTotals.vaca / realizedTotals.total) * 100 : 0;
    const abacaxiPercent = realizedTotals.total ? (realizedTotals.abacaxi / realizedTotals.total) * 100 : 0;
    const generatedAt = new Date().toLocaleString('pt-BR');
    const listItems = (items: { name: string; realizedCount?: number }[]) =>
      items.length
        ? items
            .map(
              (item) =>
                `<li><strong>${item.name}</strong> - ${Number(item.realizedCount || 0)} realizados</li>`
            )
            .join('')
        : '<li>Sem dados suficientes.</li>';

    win.document.write(`
      <html>
        <head>
          <title>Rentabilidade X Realizado</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            h2 { font-size: 16px; margin-top: 18px; }
            p { font-size: 12px; color: #4b5563; }
            .brand { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: #1f2937; text-transform: uppercase; }
            .brand-sub { font-size: 11px; color: #6b7280; margin-top: 4px; }
            .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
            .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
            .metric { font-size: 20px; font-weight: 700; }
            ul { padding-left: 18px; font-size: 12px; color: #374151; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 11px; background: #f3f4f6; }
            .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="brand">Controle Clinic</div>
          <div class="brand-sub">Relatório automático do sistema</div>
          <div class="brand-sub">Gerado em ${generatedAt}</div>

          <h1>Rentabilidade X Realizado</h1>
          <p>Cruzamento entre o que é mais rentável e o que a clínica executa no dia a dia.</p>

          <div class="grid">
            <div class="card">
              <div class="badge">Procedimentos estrela</div>
              <div class="metric">${percent(starsPercent)}</div>
            </div>
            <div class="card">
              <div class="badge">Procedimentos vaca leiteira</div>
              <div class="metric">${percent(vacaPercent)}</div>
            </div>
            <div class="card">
              <div class="badge">Procedimentos abacaxi</div>
              <div class="metric">${percent(abacaxiPercent)}</div>
            </div>
          </div>

          <div class="card" style="margin-top: 16px;">
            <div class="badge">Indice de eficiencia</div>
            <div class="metric">${efficiencyScore.toFixed(0)}%</div>
            <p>Quanto mais procedimentos estrela e menos abacaxi, maior a eficiencia.</p>
          </div>

          <h2>Oportunidades de crescimento</h2>
          <ul>${listItems(topOpportunities.starsLowRealized)}</ul>

          <h2>Pontos de atencao</h2>
          <ul>${listItems(topOpportunities.painPoints)}</ul>

          <h2>Sugestoes de melhoria</h2>
          <ul>
            <li>Reforcar a divulgacao dos procedimentos estrela e treinar o time comercial.</li>
            <li>Revisar precificacao dos procedimentos abacaxi e avaliar substituicao.</li>
            <li>Criar combos ou upgrades para vacas leiteiras, aumentando ticket e reduzindo tempo.</li>
            <li>Ajustar agenda para aumentar volume de estrelas sem sacrificar qualidade.</li>
          </ul>

          <div class="footer">Controle Clinic</div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Matriz de Foco</h1>
        <p className="text-gray-500">Precificação • Matriz de Foco</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('mapa')}
          className={`px-3 py-2 rounded-lg text-sm border transition ${
            tab === 'mapa'
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Mapa de rentabilidade
        </button>
        <button
          type="button"
          onClick={() => setTab('analise')}
          className={`px-3 py-2 rounded-lg text-sm border transition ${
            tab === 'analise'
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Rentabilidade X Realizado
        </button>
      </div>

      {tab === 'mapa' && (
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 max-w-xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 text-blue-700 text-sm">
            <Target size={16} /> custo hora clinica
          </div>
          <p className="mt-2 text-xl font-semibold text-blue-700">{formatCurrency(costPerHour || 0)}</p>
        </div>
      )}

      {tab === 'mapa' && !isChartExpanded && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Mapa de rentabilidade</h2>
              <p className="text-sm text-gray-500">X = horas gastas • Y = rentabilidade</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>{loading ? 'Carregando...' : `${points.length} procedimentos`}</span>
              <button
                type="button"
                onClick={() => setIsChartExpanded(true)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Tela cheia
              </button>
            </div>
          </div>
          <div className="relative h-[420px]">
            {renderBucketFilters()}
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Horas gastas"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  label={{ value: 'Horas gastas', position: 'insideBottom', offset: -4, fill: '#94a3b8' }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Rentabilidade"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(val) => formatCurrency(Number(val || 0))}
                />
                <Tooltip content={<TooltipContent />} />
                <Legend />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                <Scatter name="Estrela" data={filteredBuckets.estrela} fill="#22c55e" />
                <Scatter name="Vaca leiteira" data={filteredBuckets.vaca} fill="#3b82f6" />
                <Scatter name="Abacaxi" data={filteredBuckets.abacaxi} fill="#ef4444" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'mapa' && isChartExpanded && (
        <div
          className="fixed inset-0 z-50 bg-black/40 p-4 sm:p-6"
          onClick={chartModalControls.onBackdropClick}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Mapa de rentabilidade</h2>
                <p className="text-sm text-gray-500">X = horas gastas • Y = rentabilidade</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{loading ? 'Carregando...' : `${points.length} procedimentos`}</span>
                <button
                  type="button"
                  onClick={() => setIsChartExpanded(false)}
                  className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="relative flex-1 min-h-[360px]">
              {renderBucketFilters()}
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Horas gastas"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    label={{ value: 'Horas gastas', position: 'insideBottom', offset: -4, fill: '#94a3b8' }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Rentabilidade"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickFormatter={(val) => formatCurrency(Number(val || 0))}
                  />
                  <Tooltip content={<TooltipContent />} />
                  <Legend />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                  <Scatter name="Estrela" data={filteredBuckets.estrela} fill="#22c55e" />
                  <Scatter name="Vaca leiteira" data={filteredBuckets.vaca} fill="#3b82f6" />
                  <Scatter name="Abacaxi" data={filteredBuckets.abacaxi} fill="#ef4444" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'analise' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Rentabilidade X Realizado</h2>
              <p className="text-sm text-gray-500">
                Cruzamento entre o que é mais rentável e o que a clínica executa no dia a dia.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
              <button
                type="button"
                onClick={() => setShowLogicModal(true)}
                className="px-3 py-2 text-xs rounded-lg text-white bg-blue-600 hover:bg-blue-700"
              >
                Como funciona
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="px-2 py-2 text-xs border border-gray-200 rounded-lg text-gray-700"
                />
                <span className="text-gray-400">até</span>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="px-2 py-2 text-xs border border-gray-200 rounded-lg text-gray-700"
                />
              </div>
              <span>{loading ? 'Atualizando dados...' : `${realizedTotals.total} procedimentos realizados`}</span>
              <button
                type="button"
                onClick={exportAnalysisPdf}
                disabled={loading}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Baixar PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            <div className="border border-emerald-100 bg-emerald-50 rounded-xl p-4">
              <p className="text-xs uppercase text-emerald-600 font-semibold">Procedimentos estrela</p>
              <p className="text-2xl font-bold text-emerald-700">
                {realizedTotals.total ? ((realizedTotals.estrela / realizedTotals.total) * 100).toFixed(1) : '0'}%
              </p>
              <p className="text-xs text-emerald-700 mt-1">Quanto mais alto, melhor.</p>
            </div>
            <div className="border border-amber-100 bg-amber-50 rounded-xl p-4">
              <p className="text-xs uppercase text-amber-600 font-semibold">Procedimentos vaca leiteira</p>
              <p className="text-2xl font-bold text-amber-700">
                {realizedTotals.total ? ((realizedTotals.vaca / realizedTotals.total) * 100).toFixed(1) : '0'}%
              </p>
              <p className="text-xs text-amber-700 mt-1">Mais volume, menor eficiência.</p>
            </div>
            <div className="border border-rose-100 bg-rose-50 rounded-xl p-4">
              <p className="text-xs uppercase text-rose-600 font-semibold">Procedimentos abacaxi</p>
              <p className="text-2xl font-bold text-rose-700">
                {realizedTotals.total ? ((realizedTotals.abacaxi / realizedTotals.total) * 100).toFixed(1) : '0'}%
              </p>
              <p className="text-xs text-rose-700 mt-1">Quanto menor, melhor.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-xs uppercase text-gray-500 font-semibold">Índice de eficiência</p>
              <p className="text-2xl font-bold text-gray-800">{efficiencyScore.toFixed(0)}%</p>
              <p className="text-xs text-gray-500 mt-1">
                Baseado em peso maior para estrelas e penalidade para abacaxis.
              </p>
            </div>
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-xs uppercase text-gray-500 font-semibold">Leitura rápida</p>
              <p className="text-sm text-gray-600 mt-2">
                Quando a participação de estrelas sobe e abacaxis caem, a clínica está operando de forma mais eficiente.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-800">Oportunidades de crescimento</p>
              <p className="text-xs text-gray-500 mb-3">Estrelas com pouca realização (treinar/impulsionar).</p>
              {topOpportunities.starsLowRealized.length === 0 ? (
                <p className="text-sm text-gray-400">Sem dados suficientes.</p>
              ) : (
                <div className="space-y-2">
                  {topOpportunities.starsLowRealized.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="text-gray-500">{item.realizedCount} realizados</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-800">Pontos de atenção</p>
              <p className="text-xs text-gray-500 mb-3">Vacas e abacaxis com alta execução.</p>
              {topOpportunities.painPoints.length === 0 ? (
                <p className="text-sm text-gray-400">Sem dados suficientes.</p>
              ) : (
                <div className="space-y-2">
                  {topOpportunities.painPoints.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="text-gray-500">{item.realizedCount} realizados</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 border border-gray-100 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-800">Sugestões de melhoria</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
              <div className="rounded-lg border border-gray-100 p-3">
                Reforçar a divulgação dos procedimentos estrela e treinar o time comercial para priorizá-los.
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                Revisar precificação dos procedimentos abacaxi e avaliar se vale manter ou substituir.
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                Criar combos ou upgrades para vacas leiteiras, aumentando ticket e reduzindo tempo por atendimento.
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                Ajustar agenda e fluxo operacional para aumentar o volume de estrelas sem sacrificar a qualidade.
              </div>
            </div>
          </div>
        </div>
      )}

      {showLogicModal && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 sm:p-6" onClick={logicModalControls.onBackdropClick}>
          <div
            className="bg-white rounded-2xl shadow-xl p-5 sm:p-6 max-w-2xl w-full mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Como calculamos a eficiência</h3>
                <p className="text-sm text-gray-500">
                  A análise cruza o volume realizado com a rentabilidade de cada procedimento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLogicModal(false)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <div>
                1. Calculamos a rentabilidade de cada procedimento com base no custo hora, insumos e preço cobrado.
              </div>
              <div>
                2. Classificamos em Estrela, Vaca leiteira ou Abacaxi conforme a rentabilidade por hora.
              </div>
              <div>
                3. Somamos o volume realizado por categoria no período filtrado.
              </div>
              <div>
                4. O índice de eficiência dá mais peso para estrelas, penaliza abacaxis e considera volume de vacas.
              </div>
              <div>
                5. Oportunidades mostram estrelas com baixa execução e pontos de atenção mostram vacas/abacaxis com alta execução.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingFocusMatrix;
