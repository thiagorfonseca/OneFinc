import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useAuth } from '../../../auth/AuthProvider';
import { fetchRespondentDetail, fetchRespondents, listPublicLinks } from '../archetypeService';
import type { ArchetypeAnswerRow, ArchetypeRespondentRow, PublicLinkRow } from '../types';
import FiltersBar, { ArchetypeFilters } from '../components/FiltersBar';
import RespondentsTable from '../components/RespondentsTable';
import DetailsDrawer from '../components/DetailsDrawer';

const toCsvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

const AnalyticsArchetypePage: React.FC = () => {
  const { effectiveClinicId: clinicId, isSystemAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ArchetypeRespondentRow[]>([]);
  const [links, setLinks] = useState<PublicLinkRow[]>([]);
  const [filters, setFilters] = useState<ArchetypeFilters>({
    dateFrom: '',
    dateTo: '',
    topProfile: '',
    audienceType: '',
    search: '',
    token: '',
  });
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRespondent, setDetailRespondent] = useState<ArchetypeRespondentRow | null>(null);
  const [detailAnswers, setDetailAnswers] = useState<ArchetypeAnswerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [respondents, publicLinks] = await Promise.all([
          fetchRespondents({ clinicId }),
          listPublicLinks(clinicId),
        ]);
        if (!active) return;
        setRows(respondents);
        setLinks(publicLinks);
      } catch (err) {
        console.error(err);
        if (active) setError('Não foi possível carregar os dados de analytics.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [clinicId]);

  const filteredRows = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;

    return rows.filter((row) => {
      const created = new Date(row.created_at);
      if (fromDate && created < fromDate) return false;
      if (toDate && created > toDate) return false;
      if (filters.topProfile && row.top_profile !== filters.topProfile) return false;
      if (filters.audienceType && row.audience_type !== filters.audienceType) return false;
      if (filters.token && row.public_token !== filters.token) return false;
      if (term) {
        const haystack = `${row.name} ${row.email || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const metrics = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    let last7 = 0;
    let last30 = 0;

    filteredRows.forEach((row) => {
      const created = new Date(row.created_at);
      if (created >= sevenDaysAgo) last7 += 1;
      if (created >= thirtyDaysAgo) last30 += 1;
    });

    return {
      total: filteredRows.length,
      last7,
      last30,
    };
  }, [filteredRows]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {
      FACILITADOR: 0,
      ANALISTA: 0,
      REALIZADOR: 0,
      VISIONÁRIO: 0,
      EMPATE: 0,
    };
    filteredRows.forEach((row) => {
      counts[row.top_profile] = (counts[row.top_profile] || 0) + 1;
    });
    return [
      { name: 'Facilitador', value: counts.FACILITADOR, color: '#22c55e' },
      { name: 'Analista', value: counts.ANALISTA, color: '#0ea5e9' },
      { name: 'Realizador', value: counts.REALIZADOR, color: '#f97316' },
      { name: 'Visionário', value: counts.VISIONÁRIO, color: '#a855f7' },
      { name: 'Empate', value: counts.EMPATE, color: '#94a3b8' },
    ];
  }, [filteredRows]);

  const averageScores = useMemo(() => {
    const totals = {
      FACILITADOR: 0,
      ANALISTA: 0,
      REALIZADOR: 0,
      VISIONÁRIO: 0,
    };
    filteredRows.forEach((row) => {
      totals.FACILITADOR += row.scores?.FACILITADOR ?? 0;
      totals.ANALISTA += row.scores?.ANALISTA ?? 0;
      totals.REALIZADOR += row.scores?.REALIZADOR ?? 0;
      totals.VISIONÁRIO += row.scores?.VISIONÁRIO ?? 0;
    });
    const divisor = filteredRows.length || 1;
    return [
      { name: 'Facilitador', value: totals.FACILITADOR / divisor, color: '#22c55e' },
      { name: 'Analista', value: totals.ANALISTA / divisor, color: '#0ea5e9' },
      { name: 'Realizador', value: totals.REALIZADOR / divisor, color: '#f97316' },
      { name: 'Visionário', value: totals.VISIONÁRIO / divisor, color: '#a855f7' },
    ];
  }, [filteredRows]);

  const handleExportCsv = () => {
    const header = [
      'Data',
      'Nome',
      'Email',
      'WhatsApp',
      'Audiência',
      'Perfil vencedor',
      'Facilitador',
      'Analista',
      'Realizador',
      'Visionário',
      'Token',
    ];
    const body = filteredRows.map((row) => [
      toCsvCell(row.created_at),
      toCsvCell(row.name),
      toCsvCell(row.email || ''),
      toCsvCell(row.phone || ''),
      toCsvCell(row.audience_type),
      toCsvCell(row.top_profile),
      toCsvCell(row.scores?.FACILITADOR ?? 0),
      toCsvCell(row.scores?.ANALISTA ?? 0),
      toCsvCell(row.scores?.REALIZADOR ?? 0),
      toCsvCell(row.scores?.VISIONÁRIO ?? 0),
      toCsvCell(row.public_token),
    ].join(','));
    const csv = [header.join(','), ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'perfil-analytics.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const openDetails = async (row: ArchetypeRespondentRow) => {
    if (!clinicId) return;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailRespondent(row);
    setDetailAnswers([]);
    try {
      const detail = await fetchRespondentDetail(row.id, clinicId);
      if (!detail) return;
      setDetailRespondent(detail as ArchetypeRespondentRow);
      setDetailAnswers(((detail as any).archetype_answers || []) as ArchetypeAnswerRow[]);
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar os detalhes do respondente.');
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-500">Carregando analytics...</div>;
  }

  if (!clinicId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-800">Arquétipos</h1>
        <p className="text-sm text-gray-500">Selecione uma clínica para visualizar os dados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Arquétipos</h1>
        <p className="text-gray-500">Recursos Humanos • Analytics de perfis comportamentais</p>
        {isSystemAdmin && (
          <p className="text-xs text-gray-400">Visualizando dados da clínica selecionada.</p>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-400">Total de respostas</p>
          <p className="text-2xl font-semibold text-gray-800">{metrics.total}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-400">Últimos 7 dias</p>
          <p className="text-2xl font-semibold text-gray-800">{metrics.last7}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-400">Últimos 30 dias</p>
          <p className="text-2xl font-semibold text-gray-800">{metrics.last30}</p>
        </div>
      </div>
      <p className="text-xs text-gray-400">Indicadores e gráficos consideram os filtros aplicados.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Distribuição do perfil vencedor</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} respostas`, '']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Média de pontuação por perfil</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={averageScores}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)} pontos`, 'Média']} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {averageScores.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <FiltersBar
        filters={filters}
        tokens={links.map((link) => link.token)}
        onChange={setFilters}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{filteredRows.length} respondentes encontrados</p>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      <RespondentsTable rows={filteredRows} onOpenDetails={openDetails} />

      <DetailsDrawer
        open={detailOpen}
        loading={detailLoading}
        onClose={() => setDetailOpen(false)}
        respondent={detailRespondent}
        answers={detailAnswers}
      />
    </div>
  );
};

export default AnalyticsArchetypePage;
