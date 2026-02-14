import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const PublicSignatureReturn: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [signUrl, setSignUrl] = useState('');
  const [refreshIn, setRefreshIn] = useState(5);
  const [continueUrl, setContinueUrl] = useState('');
  const [redirectIn, setRedirectIn] = useState<number | null>(null);

  const checkStatus = useCallback(async () => {
    if (!token) {
      setMessage('Token inválido.');
      setLoading(false);
      return;
    }
    setChecking(true);
    try {
      const res = await fetch(`/api/public/proposals/${token}/status`);
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        setMessage('Não foi possível consultar o status da assinatura.');
        setLoading(false);
        setChecking(false);
        return;
      }
      const data = await res.json().catch(() => ({}));
      const status = data?.status || '';
      if (status === 'signed' || status === 'paid' || status === 'payment_created') {
        const next = `/pagamento/${token}`;
        setContinueUrl(next);
        setMessage('Assinatura confirmada. Redirecionando para o pagamento...');
        setRedirectIn(5);
        setLoading(false);
        setChecking(false);
        return;
      }
      setSignUrl(data?.signatureUrl || '');
      setMessage('Assinatura ainda não confirmada.');
    } catch {
      setMessage('Erro ao consultar assinatura.');
    }
    setLoading(false);
    setChecking(false);
  }, [token]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (!token || continueUrl) return;
    const countdownId = window.setInterval(() => {
      setRefreshIn((value) => (value <= 1 ? 5 : value - 1));
    }, 1000);
    const pollId = window.setInterval(() => {
      checkStatus();
    }, 5000);
    return () => {
      window.clearInterval(countdownId);
      window.clearInterval(pollId);
    };
  }, [token, continueUrl, checkStatus]);

  useEffect(() => {
    if (!continueUrl || redirectIn === null) return;
    if (redirectIn <= 0) {
      navigate(continueUrl, { replace: true });
      return;
    }
    const timer = window.setTimeout(() => {
      setRedirectIn((value) => (value === null ? null : value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [continueUrl, redirectIn, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-6 max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-semibold text-gray-800">Processando assinatura</h1>
        <p className="text-sm text-gray-500">{message}</p>
        {continueUrl ? (
          <button
            type="button"
            onClick={() => navigate(continueUrl, { replace: true })}
            className="inline-flex items-center justify-center px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700"
          >
            Continuar
          </button>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-gray-400">
              Atualizando em {refreshIn}s
            </div>
            <button
              type="button"
              onClick={() => {
                setRefreshIn(5);
                checkStatus();
              }}
              className="inline-flex items-center justify-center px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700"
              disabled={checking}
            >
              {checking ? 'Atualizando...' : 'Atualizar agora'}
            </button>
            {signUrl ? (
              <a
                href={signUrl}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-300"
              >
                Voltar para assinatura
              </a>
            ) : null}
          </div>
        )}
        {continueUrl && redirectIn !== null ? (
          <p className="text-xs text-gray-400">Redirecionando em {redirectIn}s</p>
        ) : null}
      </div>
    </div>
  );
};

export default PublicSignatureReturn;
