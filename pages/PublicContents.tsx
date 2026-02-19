import React from 'react';
import { BookOpen, FileText, Sparkles } from 'lucide-react';
import PublicHeader from '../components/public/PublicHeader';

const PublicContents: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-amber-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <PublicHeader />

        <section className="mt-12">
          <h1 className="text-4xl md:text-5xl font-semibold">Conteúdos gratuitos para clínicas que querem crescer.</h1>
          <p className="mt-4 text-lg text-slate-600">
            Materiais estratégicos, guias práticos e insights para gestão financeira e operacional.
          </p>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-slate-700">
              <BookOpen size={22} />
              <h3 className="text-lg font-semibold">Recursos gratuitos</h3>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li>Checklist de organização financeira para clínicas.</li>
              <li>Planilha de metas e indicadores de performance.</li>
              <li>Roteiro para estruturar um time de atendimento.</li>
            </ul>
            <a
              href="https://app.controleclinic.com.br/login"
              className="mt-6 inline-flex px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold"
            >
              Acessar a plataforma
            </a>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-slate-700">
              <FileText size={22} />
              <h3 className="text-lg font-semibold">Blog e artigos</h3>
            </div>
            <div className="mt-4 space-y-4">
              {[
                'Como reduzir faltas e aumentar a ocupação da agenda',
                'Boas práticas para controle de caixa em clínicas',
                'Como definir preços sem perder margem',
              ].map((title) => (
                <div key={title} className="rounded-xl border border-slate-100 p-3">
                  <p className="text-sm font-semibold text-slate-800">{title}</p>
                  <p className="text-xs text-slate-500 mt-1">Leitura rápida • 5 min</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-2xl bg-slate-900 text-white p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-amber-300 text-sm">
              <Sparkles size={18} /> Conteúdos exclusivos
            </div>
            <h2 className="mt-2 text-2xl font-semibold">Quer materiais personalizados para sua clínica?</h2>
            <p className="mt-2 text-sm text-slate-300">Fale com a equipe e receba um diagnóstico inicial.</p>
          </div>
          <a
            href="https://app.controleclinic.com.br/login"
            className="px-5 py-3 rounded-xl bg-white text-slate-900 text-sm font-semibold"
          >
            Acessar a plataforma
          </a>
        </section>
      </div>
    </div>
  );
};

export default PublicContents;
