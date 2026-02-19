import React from 'react';
import { Link } from 'react-router-dom';

const AccessDenied: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">Acesso negado</h1>
        <p className="text-gray-600">Você não tem permissão para acessar esta página.</p>
        <div className="flex justify-center gap-3 text-sm">
          <Link to="/app" className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700">Ir para o início</Link>
          <Link to="/login" className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">Login</Link>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
