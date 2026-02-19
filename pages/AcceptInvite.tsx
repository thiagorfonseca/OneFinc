import React, { useEffect, useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AcceptInvite: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<'checking' | 'need-auth' | 'success' | 'error'>('checking');
  const [message, setMessage] = useState<string>('Validando convite...');
  const [redirect, setRedirect] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Token não informado.');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus('need-auth');
        setMessage('Faça login para aceitar o convite.');
        return;
      }
      try {
        const response = await fetch('/api/public/resolve-clinic-membership', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ inviteToken: token }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body?.error || body?.details || 'Erro ao aceitar convite.');
        }
        setStatus('success');
        setMessage('Convite aceito com sucesso! Redirecionando...');
        setTimeout(() => setRedirect(true), 1200);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Erro ao aceitar convite.');
      }
    };
    run();
  }, [token]);

  if (redirect) return <Navigate to="/app" replace />;

  if (status === 'need-auth') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-6 max-w-md w-full space-y-3 text-center">
          <h1 className="text-lg font-bold text-gray-800">Login necessário</h1>
          <p className="text-sm text-gray-600">{message}</p>
          <a
            href={`/login?redirectTo=/accept-invite%3Ftoken%3D${encodeURIComponent(token || '')}`}
            className="inline-flex justify-center px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"
          >
            Ir para login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-6 max-w-md w-full space-y-3 text-center">
        <h1 className="text-lg font-bold text-gray-800">Convite</h1>
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
};

export default AcceptInvite;
