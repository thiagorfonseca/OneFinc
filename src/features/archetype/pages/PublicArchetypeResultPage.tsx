import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import ResultChart from '../components/ResultChart';
import type { ArchetypeResult } from '../types';

const PROFILE_TEXT: Record<string, string> = {
  FACILITADOR: 'Você valoriza harmonia, colaboração e equilíbrio nas relações.',
  ANALISTA: 'Você é detalhista, analítico e gosta de decisões bem fundamentadas.',
  REALIZADOR: 'Você é orientado a resultados, pragmático e gosta de desafios.',
  VISIONÁRIO: 'Você é criativo, comunicativo e busca inspirar pessoas ao redor.',
  EMPATE: 'Seus resultados ficaram equilibrados entre mais de um perfil.',
};

const PublicArchetypeResultPage: React.FC = () => {
  const { publicToken } = useParams();
  const location = useLocation();
  const [result, setResult] = useState<ArchetypeResult | null>(null);

  useEffect(() => {
    const stateResult = (location.state as any)?.result as ArchetypeResult | undefined;
    if (stateResult) {
      setResult(stateResult);
      return;
    }
    if (!publicToken) return;
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(`archetypeResult:${publicToken}`) : null;
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setResult(parsed);
    } catch {
      // ignore
    }
  }, [location.state, publicToken]);

  const summaryText = useMemo(() => {
    if (!result) return '';
    if (result.topProfile === 'EMPATE') return PROFILE_TEXT.EMPATE;
    return PROFILE_TEXT[result.topProfile] || '';
  }, [result]);

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-8 max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-gray-800">Resultado indisponível</h1>
          <p className="text-sm text-gray-500">Volte ao link do teste para gerar o resultado.</p>
          {publicToken && (
            <Link
              to={`/public/perfil/${publicToken}`}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-brand-600 text-white text-sm"
            >
              Refazer teste
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-800">Seu resultado</h1>
          <p className="text-gray-500">Confira sua pontuação e perfil predominante.</p>
        </header>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">Perfil vencedor</p>
              <h2 className="text-2xl font-semibold text-gray-800">{result.topProfile}</h2>
              {result.topProfile === 'EMPATE' && result.topProfiles.length > 0 && (
                <p className="text-sm text-gray-500">Empate entre: {result.topProfiles.join(', ')}</p>
              )}
            </div>
            <div className="text-sm text-gray-500 max-w-xs">{summaryText}</div>
          </div>
          <ResultChart scores={result.scores} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {Object.entries(result.percentages).map(([profile, value]) => (
              <div key={profile} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">{profile}</p>
                <p className="text-lg font-semibold text-gray-800">{value.toFixed(0)}%</p>
              </div>
            ))}
          </div>
        </div>

        {publicToken && (
          <Link
            to={`/public/perfil/${publicToken}`}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-200 text-gray-600"
          >
            Refazer teste
          </Link>
        )}
      </div>
    </div>
  );
};

export default PublicArchetypeResultPage;
