import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const normalizeAuthError = (raw: string) => {
  const lower = raw.toLowerCase();
  if (lower.includes('code verifier') || lower.includes('code_verifier')) {
    return 'Link aberto em outro navegador/dispositivo. Solicite um novo link.';
  }
  if (lower.includes('invalid') || lower.includes('expired') || lower.includes('access_denied')) {
    return 'Link inválido ou expirado. Solicite um novo link.';
  }
  return raw;
};

const logDebug = (label: string, info: Record<string, unknown>) => {
  if (import.meta.env.DEV) {
    console.log(`[auth-reset] ${label}`, info);
  }
};

const AuthReset: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Validando link de recuperação...');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const current = new URL(window.location.href);
        const rawHash = current.hash.startsWith('#') ? current.hash.slice(1) : current.hash;
        const hashQuery = rawHash.includes('?') ? rawHash.split('?')[1] : rawHash;
        const hashParams = new URLSearchParams(hashQuery);
        const code = current.searchParams.get('code') || hashParams.get('code');
        const errorParam =
          current.searchParams.get('error_description') ||
          current.searchParams.get('error') ||
          hashParams.get('error_description') ||
          hashParams.get('error');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        logDebug('params', {
          hasCode: Boolean(code),
          hasAccessToken: Boolean(accessToken),
          hasRefreshToken: Boolean(refreshToken),
          errorParam,
        });

        if (errorParam) {
          setStatus('error');
          setMessage(normalizeAuthError(errorParam));
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus('error');
            setMessage(normalizeAuthError(error.message || 'Erro ao validar recuperação.'));
            return;
          }
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setStatus('error');
            setMessage(normalizeAuthError(error.message || 'Erro ao validar recuperação.'));
            return;
          }
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setStatus('error');
          setMessage('Sessão de recuperação não encontrada. Solicite um novo link.');
          return;
        }

        setStatus('ready');
        setMessage('Defina sua nova senha.');
      } catch (err: any) {
        setStatus('error');
        setMessage(normalizeAuthError(err?.message || 'Erro ao validar recuperação.'));
      }
    };

    run();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (password.length < 6) {
      setFormError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setFormError('As senhas não conferem.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setFormError('Erro ao atualizar senha: ' + error.message);
      setSaving(false);
      return;
    }
    await supabase.auth.signOut();
    setStatus('success');
    setMessage('Senha atualizada com sucesso. Faça login novamente.');
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white shadow-md rounded-lg p-6 w-full max-w-md space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-600 text-white flex items-center justify-center">
            <Lock size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Redefinir senha</h1>
            <p className="text-sm text-gray-500">{message}</p>
          </div>
        </div>

        {status === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="animate-spin" size={16} />
            Carregando...
          </div>
        )}

        {status === 'error' && (
          <>
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {message}
            </div>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700"
            >
              Voltar para login
            </button>
          </>
        )}

        {status === 'ready' && (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nova senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirmar nova senha</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-brand-500"
              />
            </div>

            {formError && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="animate-spin" size={16} />}
              Atualizar senha
            </button>
          </form>
        )}

        {status === 'success' && (
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700"
          >
            Ir para login
          </button>
        )}
      </div>
    </div>
  );
};

export default AuthReset;
