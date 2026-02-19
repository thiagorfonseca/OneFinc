import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Calendar, CheckCircle2, ClipboardList } from 'lucide-react';
import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import { getAppUrl } from '../lib/utils';

const SolutionMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
    <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
  </div>
);

const PublicSolution: React.FC = () => {
  const appUrl = getAppUrl();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 text-slate-900">
      <div className="relative overflow-hidden">
        <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute -bottom-24 left-0 h-64 w-64 rounded-full bg-slate-200/60 blur-3xl" />
        <div className="max-w-6xl mx-auto px-6 py-14">
          <PublicHeader />

          <main className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
                Solução completa para clínicas que querem previsibilidade e crescimento.
              </h1>
              <p className="mt-4 text-lg text-slate-600">
                Centralize operações, acompanhe indicadores críticos e automatize processos para ganhar escala sem perder controle.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={`${appUrl}/login`}
                  className="px-5 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
                >
                  Acessar a plataforma
                </a>
                <Link
                  to="/precos"
                  className="px-5 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
                >
                  Ver planos
                </Link>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-2xl p-6 shadow-xl">
              <div className="grid grid-cols-2 gap-4">
                <SolutionMetric label="Receita" value="R$ 128k" />
                <SolutionMetric label="Taxa de retorno" value="42%" />
                <SolutionMetric label="Agendamentos" value="+28%" />
                <SolutionMetric label="Ticket médio" value="R$ 420" />
              </div>
              <div className="mt-6 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 p-4 text-white">
                <div className="flex items-center justify-between text-sm">
                  <span>Performance mensal</span>
                  <span className="font-semibold">+18%</span>
                </div>
                <svg viewBox="0 0 200 60" className="mt-3 w-full">
                  <polyline
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="3"
                    points="0,50 30,40 60,42 90,30 120,22 150,18 180,8 200,10"
                  />
                </svg>
              </div>
            </div>
          </main>

          <section className="mt-16 grid gap-6 md:grid-cols-2">
            {[
              {
                icon: Calendar,
                title: 'Agenda inteligente',
                description: 'Visualize ocupação, bloqueios e aproveite integrações com Google Calendar.',
              },
              {
                icon: ClipboardList,
                title: 'Contratos e propostas',
                description: 'Gere propostas e contratos digitais em poucos cliques e acompanhe o status.',
              },
              {
                icon: BarChart3,
                title: 'Indicadores em tempo real',
                description: 'Dashboards financeiros e comerciais para decisões rápidas.',
              },
              {
                icon: CheckCircle2,
                title: 'Padronização de processos',
                description: 'Fluxos claros para vendas, atendimento e cobrança.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <item.icon size={20} />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
              </div>
            ))}
          </section>

          <PublicFooter />
        </div>
      </div>
    </div>
  );
};

export default PublicSolution;
