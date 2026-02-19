import React from 'react';
import { Link } from 'react-router-dom';
import { getAppUrl } from '../../lib/utils';

const PublicHeader: React.FC = () => {
  const appUrl = getAppUrl();
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <img
          src="/controle-clinic-logo-pto.png"
          alt="Controle Clinic"
          className="w-[200px] h-auto object-contain"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <nav className="hidden md:flex items-center gap-4">
          <Link to="/solucao" className="hover:text-slate-900">
            Solução
          </Link>
          <Link to="/precos" className="hover:text-slate-900">
            Preços e Planos
          </Link>
          <Link to="/conteudos" className="hover:text-slate-900">
            Conteúdos
          </Link>
        </nav>
        <a
          href={`${appUrl}/login`}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700"
        >
          Acessar a plataforma
        </a>
      </div>
    </header>
  );
};

export default PublicHeader;
