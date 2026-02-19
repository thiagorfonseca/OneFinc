import React from 'react';
import { Link } from 'react-router-dom';

const HomePublic: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-slate-100 text-slate-900">
      <div className="relative overflow-hidden">
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-slate-200/60 blur-3xl" />
        <div className="max-w-6xl mx-auto px-6 py-14">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-lg font-semibold">
                OF
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Plataforma</p>
                <h1 className="text-2xl font-semibold">Controle Clinic</h1>
              </div>
            </div>
            <Link to="/login" className="text-sm text-slate-600 underline">
              Acessar conta
            </Link>
          </header>

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
                <Link
                  to="/login"
                  className="px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold"
                >
                  Entrar na plataforma
                </Link>
                <a
                  href="mailto:suporte@controleclinic.com.br"
                  className="px-5 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
                >
                  Falar com suporte
                </a>
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

          <footer className="mt-14 border-t border-slate-200 pt-6 text-xs text-slate-500 flex flex-wrap items-center gap-3 justify-between">
            <span>Controle Clinic</span>
            <div className="flex flex-wrap gap-4">
              <Link to="/politica-de-privacidade" className="underline">
                Política de Privacidade
              </Link>
              <Link to="/termos-de-servico" className="underline">
                Termos de Serviço
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default HomePublic;
