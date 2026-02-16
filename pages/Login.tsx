import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
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
  const trimmedEmail = email.trim();
  const canUseEmail = trimmedEmail.length > 0;
  const canUsePassword = canUseEmail && password.trim().length > 0;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error, data } = await supabase.auth.signUp({
          email: trimmedEmail,
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
          email: trimmedEmail,
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
        email: trimmedEmail,
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
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: resetRedirectUrl,
    });
    setLoading(false);
    if (error) setError('Erro ao enviar reset de senha: ' + error.message);
    else alert('Enviamos um email para redefinir sua senha.');
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-icon">
          <img src="/logo-onefinc.png" alt="OneFinc" className="h-8 w-8 object-contain" />
        </div>

        <div className="auth-header">
          <h1>Entrar ou cadastrar-se</h1>
          <p>{isSignUp ? 'Crie sua conta para começar com a OneFinc.' : 'Escolha seu método de acesso para continuar.'}</p>
        </div>

        <div className="auth-socials">
          <button type="button" onClick={handleGoogle} className="auth-social-button" disabled={loading}>
            <span className="auth-social-icon google">G</span>
            Continuar com Google
          </button>
        </div>

        <div className="auth-divider">
          <span>Ou</span>
        </div>

        <form className="auth-form" onSubmit={handleAuth}>
          <div className="auth-field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Digite seu endereço de e-mail"
              className="auth-input"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required={isSignUp}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="auth-input"
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            type="submit"
            disabled={loading || !canUsePassword}
            className="auth-primary"
          >
            {loading ? 'Processando...' : isSignUp ? 'Criar conta com senha' : 'Entrar com senha'}
          </button>

          {!isSignUp && (
            <>
              <button
                type="button"
                onClick={handleMagicLink}
                className="auth-magic"
                disabled={loading || !canUseEmail}
              >
                <svg className="auth-magic-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3zM18.5 15.5l.7 1.9 1.8.7-1.8.7-.7 1.9-.7-1.9-1.8-.7 1.8-.7.7-1.9z"
                    fill="currentColor"
                  />
                </svg>
                Enviar link mágico
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                className="auth-link"
                disabled={loading || !canUseEmail}
              >
                Esqueci minha senha
              </button>
            </>
          )}
        </form>

        <div className="auth-divider auth-divider-soft">
          <span>{isSignUp ? 'Já tem uma conta?' : 'Novo por aqui?'}</span>
        </div>

        <button onClick={() => setIsSignUp(!isSignUp)} className="auth-secondary">
          {isSignUp ? 'Voltar para Login' : 'Criar nova conta'}
        </button>

        <div className="mt-6 text-xs text-[var(--auth-muted)] flex flex-wrap items-center gap-2 justify-center">
          <span>Ao continuar, você concorda com</span>
          <Link to="/termos-de-servico" className="auth-link">
            Termos de Serviço
          </Link>
          <span>e</span>
          <Link to="/politica-de-privacidade" className="auth-link">
            Política de Privacidade
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
