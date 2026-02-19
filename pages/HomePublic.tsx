import React from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import { getAppUrl } from '../lib/utils';

const HomePublic: React.FC = () => {
  const appUrl = getAppUrl();
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-slate-100 text-slate-900">
      <div className="relative overflow-hidden">
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-slate-200/60 blur-3xl" />
        <div className="max-w-6xl mx-auto px-6 py-14">
          <PublicHeader />

          <main className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] items-center">
            <div style={{ fontFamily: 'Manrope, ui-sans-serif, system-ui, sans-serif' }}>
              <h2 className="text-4xl md:text-5xl font-semibold leading-tight text-slate-900">
                Gestão financeira e operacional para clínicas que querem previsibilidade.
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                O Controle Clinic centraliza agenda, contratos, pagamentos e indicadores para clínicas e consultores.
                Tudo em um só painel, com integrações e automações para reduzir retrabalho.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={`${appUrl}/login`}
                  className="px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold"
                >
                  Acessar a plataforma
                </a>
                <a
                  href="mailto:suporte@controleclinic.com.br"
                  className="px-5 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
                >
                  Falar com suporte
                </a>
                <Link
                  to="/precos"
                  className="px-5 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
                >
                  Ver preços e planos
                </Link>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">O que o Controle Clinic entrega</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                  <p>Agendas inteligentes e integração com Google Calendar.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                  <p>Contratos, propostas e cobrança em um fluxo automatizado.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                  <p>Indicadores de rentabilidade e eficiência operacional.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                  <p>Controle de acesso multi-clínicas e governança interna.</p>
                </div>
              </div>
            </div>
          </main>

          <section className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Solução completa',
                description: 'Fluxos integrados de agenda, cobrança, contratos e desempenho em um só lugar.',
                link: '/solucao',
              },
              {
                title: 'Planos flexíveis',
                description: 'Escolha o pacote ideal para o estágio da sua clínica e evolua quando quiser.',
                link: '/precos',
              },
              {
                title: 'Conteúdos estratégicos',
                description: 'Materiais gratuitos e blog com insights para gestão e crescimento.',
                link: '/conteudos',
              },
            ].map((card) => (
              <Link
                key={card.title}
                to={card.link}
                className="group rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm hover:shadow-md transition"
              >
                <h4 className="text-base font-semibold text-slate-900 group-hover:text-brand-700">{card.title}</h4>
                <p className="mt-2 text-sm text-slate-600">{card.description}</p>
                <span className="mt-4 inline-flex text-sm text-brand-600">Saiba mais</span>
              </Link>
            ))}
          </section>

          <section className="mt-14 grid gap-6 md:grid-cols-3 text-sm text-slate-600">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h4 className="text-base font-semibold text-slate-900">Segurança e LGPD</h4>
              <p className="mt-2">
                Dados protegidos com autenticação segura, controle de permissões e processos alinhados à LGPD.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h4 className="text-base font-semibold text-slate-900">Visão financeira clara</h4>
              <p className="mt-2">
                Receitas, pagamentos e performance reunidos para decisões rápidas e fundamentadas.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h4 className="text-base font-semibold text-slate-900">Integrações essenciais</h4>
              <p className="mt-2">
                Assinatura digital, cobrança e calendários integrados ao fluxo da clínica.
              </p>
            </div>
          </section>

          <PublicFooter />
        </div>
      </div>
    </div>
  );
};

export default HomePublic;
