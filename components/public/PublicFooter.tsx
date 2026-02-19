import React from 'react';
import { Link } from 'react-router-dom';

const PublicFooter: React.FC = () => {
  return (
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
  );
};

export default PublicFooter;
