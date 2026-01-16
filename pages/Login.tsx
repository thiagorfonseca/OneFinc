import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { buildPublicUrl } from '../lib/utils';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const callbackUrl = buildPublicUrl('/auth/callback');
  const resetRedirectUrl = buildPublicUrl('/auth/reset');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: callbackUrl,
          },
        });
        if (error) throw error;
        
        // Quick setup for demo: Create a clinic and profile automatically
        if (data.user) {
          // 1. Create Clinic
          const { data: clinicData, error: clinicError } = await supabase
            .from('clinics')
            .insert([{ name: 'Minha Clínica' }])
            .select()
            .single();
            
          if (clinicError) {
             // Fallback if RLS blocks (unlikely if table public or using service key initially)
             console.error(clinicError);
          } else if (clinicData) {
            // 2. Create Profile
            await supabase.from('profiles').insert([{
              id: data.user.id,
              clinic_id: clinicData.id,
              full_name: email.split('@')[0],
              role: 'admin'
            }]);
          }
        }
        alert('Cadastro realizado! Verifique seu email ou faça login.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          queryParams: { prompt: 'consent' },
        }
      });
      if (error) setError('Erro ao entrar com Google: ' + error.message);
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao entrar com Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl, shouldCreateUser: true }
      });
      if (error) setError('Erro ao enviar magic link: ' + error.message);
      else alert('Enviamos um link de acesso para o seu email.');
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao enviar magic link.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirectUrl,
    });
    setLoading(false);
    if (error) setError('Erro ao enviar reset de senha: ' + error.message);
    else alert('Enviamos um email para redefinir sua senha.');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-brand-600">
          <div className="w-12 h-12 bg-brand-500 rounded-lg flex items-center justify-center text-white">
            <Wallet size={32} />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          OnePay
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {isSignUp ? 'Crie sua conta e da sua clínica' : 'Faça login para acessar o sistema'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleAuth}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Senha
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50"
              >
                {loading ? 'Processando...' : isSignUp ? 'Criar Conta' : 'Entrar'}
              </button>
            </div>
          </form>

          {!isSignUp && (
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={handleGoogle}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                disabled={loading}
              >
                Entrar com Google
              </button>
              <button
                type="button"
                onClick={handleMagicLink}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                disabled={loading || !email}
              >
                Enviar Magic Link
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                className="text-sm text-blue-600 hover:underline"
                disabled={loading || !email}
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  {isSignUp ? 'Já tem uma conta?' : 'Novo por aqui?'}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                {isSignUp ? 'Voltar para Login' : 'Criar nova conta'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
