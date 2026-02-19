import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { formatCurrency, getAppUrl } from '../lib/utils';
import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';

const PublicPricing: React.FC = () => {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const appUrl = getAppUrl();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/public/pricing-packages');
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          setError('Não foi possível carregar os planos.');
          return;
        }
        const data = await res.json();
        setPackages(data?.packages || []);
      } catch {
        setError('Não foi possível carregar os planos.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-slate-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <PublicHeader />

        <section className="mt-12">
          <h1 className="text-4xl md:text-5xl font-semibold">Preços e planos flexíveis para cada etapa.</h1>
          <p className="mt-4 text-lg text-slate-600">
            Edite produtos e valores no painel admin. Aqui exibimos os pacotes configurados pela sua equipe.
          </p>
        </section>

        {loading ? (
          <div className="mt-8 text-slate-500 flex items-center gap-2">
            <Loader2 className="animate-spin" size={18} /> Carregando planos...
          </div>
        ) : error ? (
          <div className="mt-8 text-sm text-rose-500">{error}</div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <div key={pkg.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
                <h3 className="text-lg font-semibold text-slate-900">{pkg.name}</h3>
                <p className="mt-2 text-sm text-slate-600">{pkg.description || 'Pacote completo para clínicas.'}</p>
                <div className="mt-4 text-2xl font-semibold text-slate-900">
                  {pkg.price_cents !== null && pkg.price_cents !== undefined
                    ? formatCurrency(pkg.price_cents / 100)
                    : 'Sob consulta'}
                </div>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {['Agenda inteligente', 'Financeiro completo', 'Relatórios de performance'].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-500" /> {item}
                    </li>
                  ))}
                </ul>
                <a
                  href={`${appUrl}/login`}
                  className="mt-6 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold text-center"
                >
                  Acessar a plataforma
                </a>
              </div>
            ))}
            {packages.length === 0 && (
              <div className="text-sm text-slate-500">Nenhum pacote disponível no momento.</div>
            )}
          </div>
        )}

        <PublicFooter />
      </div>
    </div>
  );
};

export default PublicPricing;
