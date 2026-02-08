import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Percent, Target, Wallet } from 'lucide-react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../src/auth/AuthProvider';
import { useModalControls } from '../hooks/useModalControls';

const PricingFocusMatrix: React.FC = () => {
  const { effectiveClinicId: clinicId } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [hoursAvailableInput, setHoursAvailableInput] = useState('120');
  const [occupancyInput, setOccupancyInput] = useState('50');
  const [taxInput, setTaxInput] = useState('15');
  const [marginInput, setMarginInput] = useState('20');
  const [cardFeeInput, setCardFeeInput] = useState('2,5');
  const [commissionInput, setCommissionInput] = useState('20');
  const [isChartExpanded, setIsChartExpanded] = useState(false);

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
        if (clinicId) {
          expQuery = expQuery.eq('clinic_id', clinicId);
          procQuery = procQuery.eq('clinic_id', clinicId);
        }
        const [{ data: expData }, { data: procData }] = await Promise.all([expQuery, procQuery]);
        setExpenses(expData || []);
        setProcedures(procData || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [clinicId]);

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

  const [showEstrela, setShowEstrela] = useState(true);
  const [showVaca, setShowVaca] = useState(true);
  const [showAbacaxi, setShowAbacaxi] = useState(true);

  const chartModalControls = useModalControls({
    isOpen: isChartExpanded,
    onClose: () => setIsChartExpanded(false),
  });

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Matriz de Foco</h1>
        <p className="text-gray-500">Precificação • Matriz de Foco</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Wallet size={16} /> Custos totais
          </div>
          <p className="mt-2 text-xl font-semibold text-gray-800">{formatCurrency(totalCosts || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Target size={16} /> Custo por hora
          </div>
          <p className="mt-2 text-xl font-semibold text-blue-700">{formatCurrency(costPerHour || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Percent size={16} /> Taxas totais
          </div>
          <p className="mt-2 text-xl font-semibold text-gray-800">{(totalRates * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-gray-600">
            <span>Horas disponíveis</span>
            <input
              value={hoursAvailableInput}
              onChange={(e) => setHoursAvailableInput(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
            />
          </label>
          <label className="flex items-center gap-2 text-gray-600">
            <span>Taxa de ocupação</span>
            <input
              value={occupancyInput}
              onChange={(e) => setOccupancyInput(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
            />
          </label>
          <label className="flex items-center gap-2 text-gray-600">
            <span>Impostos</span>
            <input
              value={taxInput}
              onChange={(e) => setTaxInput(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
            />
          </label>
          <label className="flex items-center gap-2 text-gray-600">
            <span>Margem</span>
            <input
              value={marginInput}
              onChange={(e) => setMarginInput(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
            />
          </label>
          <label className="flex items-center gap-2 text-gray-600">
            <span>Taxa cartão</span>
            <input
              value={cardFeeInput}
              onChange={(e) => setCardFeeInput(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
            />
          </label>
          <label className="flex items-center gap-2 text-gray-600">
            <span>Comissão</span>
            <input
              value={commissionInput}
              onChange={(e) => setCommissionInput(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
            <ArrowUpRight size={16} /> ⭐ Estrelas
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-800">{buckets.estrela.length}</p>
          <p className="text-xs text-gray-500">51% a 1000% do custo hora</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-blue-600 text-sm font-semibold">
            <Target size={16} /> 🐄 Vaca leiteira
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-800">{buckets.vaca.length}</p>
          <p className="text-xs text-gray-500">0% a 50% do custo hora</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-red-600 text-sm font-semibold">
            <ArrowDownRight size={16} /> 🍍 Abacaxi
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-800">{buckets.abacaxi.length}</p>
          <p className="text-xs text-gray-500">Abaixo de 0% do custo hora</p>
        </div>
      </div>

      {!isChartExpanded && (
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
          <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-4">
            <button
              type="button"
              onClick={() => setShowEstrela((prev) => !prev)}
              className={`px-3 py-1 rounded-full border ${showEstrela ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}
            >
              ⭐ Estrelas
            </button>
            <button
              type="button"
              onClick={() => setShowVaca((prev) => !prev)}
              className={`px-3 py-1 rounded-full border ${showVaca ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}
            >
              🐄 Vaca leiteira
            </button>
            <button
              type="button"
              onClick={() => setShowAbacaxi((prev) => !prev)}
              className={`px-3 py-1 rounded-full border ${showAbacaxi ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}
            >
              🍍 Abacaxi
            </button>
          </div>
          <div className="h-[420px]">
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
                {showEstrela && <Scatter name="Estrela" data={buckets.estrela} fill="#22c55e" />}
                {showVaca && <Scatter name="Vaca leiteira" data={buckets.vaca} fill="#3b82f6" />}
                {showAbacaxi && <Scatter name="Abacaxi" data={buckets.abacaxi} fill="#ef4444" />}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {isChartExpanded && (
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

            <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-4">
              <button
                type="button"
                onClick={() => setShowEstrela((prev) => !prev)}
                className={`px-3 py-1 rounded-full border ${showEstrela ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}
              >
                ⭐ Estrelas
              </button>
              <button
                type="button"
                onClick={() => setShowVaca((prev) => !prev)}
                className={`px-3 py-1 rounded-full border ${showVaca ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}
              >
                🐄 Vaca leiteira
              </button>
              <button
                type="button"
                onClick={() => setShowAbacaxi((prev) => !prev)}
                className={`px-3 py-1 rounded-full border ${showAbacaxi ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}
              >
                🍍 Abacaxi
              </button>
            </div>

            <div className="relative flex-1 min-h-[360px]">
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
                  {showEstrela && <Scatter name="Estrela" data={buckets.estrela} fill="#22c55e" />}
                  {showVaca && <Scatter name="Vaca leiteira" data={buckets.vaca} fill="#3b82f6" />}
                  {showAbacaxi && <Scatter name="Abacaxi" data={buckets.abacaxi} fill="#ef4444" />}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingFocusMatrix;
