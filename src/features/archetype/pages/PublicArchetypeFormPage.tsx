import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { resolvePublicToken, submitRespondent } from '../archetypeService';
import { ARCHETYPE_PROFILES, ARCHETYPE_QUESTIONS } from '../archetypeQuestions';
import type { ArchetypeAnswer, ArchetypeResult, PublicTokenResolution } from '../types';
import { computePercentages, computeScores, computeTopProfile } from '../scoring';
import Progress from '../components/Progress';
import QuestionCard from '../components/QuestionCard';

const TOTAL_QUESTIONS = ARCHETYPE_QUESTIONS.length;

const emptyAnswers = Array.from({ length: TOTAL_QUESTIONS }, () => null as number | null);

const defaultForm = {
  name: '',
  email: '',
  phone: '',
  profession: '',
  city: '',
  consent: false,
};

const PublicArchetypeFormPage: React.FC = () => {
  const { publicToken } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<PublicTokenResolution | null>(null);
  const [invalidToken, setInvalidToken] = useState(false);
  const [step, setStep] = useState<'intro' | 'quiz'>('intro');
  const [form, setForm] = useState(defaultForm);
  const [answers, setAnswers] = useState<Array<number | null>>(emptyAnswers);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const draftKey = publicToken ? `archetypeDraft:${publicToken}` : '';

  useEffect(() => {
    if (!publicToken) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      const info = await resolvePublicToken(publicToken);
      if (!active) return;
      if (!info) {
        setInvalidToken(true);
        setTokenInfo(null);
      } else {
        setInvalidToken(false);
        setTokenInfo(info);
      }
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [publicToken]);

  useEffect(() => {
    if (!draftKey) return;
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(draftKey) : null;
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.form) setForm((prev) => ({ ...prev, ...parsed.form }));
      if (Array.isArray(parsed?.answers) && parsed.answers.length === TOTAL_QUESTIONS) {
        setAnswers(parsed.answers as Array<number | null>);
      }
      if (typeof parsed?.currentIndex === 'number') {
        const clamped = Math.min(Math.max(parsed.currentIndex, 0), TOTAL_QUESTIONS - 1);
        setCurrentIndex(clamped);
      }
      if (parsed?.step === 'quiz') setStep('quiz');
    } catch {
      // ignore invalid draft
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    if (typeof window === 'undefined') return;
    const payload = {
      form,
      answers,
      currentIndex,
      step,
    };
    window.localStorage.setItem(draftKey, JSON.stringify(payload));
  }, [draftKey, form, answers, currentIndex, step]);

  const answeredCount = useMemo(() => answers.filter((item) => item !== null).length, [answers]);
  const allAnswered = answeredCount === TOTAL_QUESTIONS;

  const handleStart = () => {
    setError(null);
    if (!form.name.trim()) {
      setError('Informe seu nome para continuar.');
      return;
    }
    if (!form.consent) {
      setError('Você precisa aceitar a LGPD para continuar.');
      return;
    }
    setStep('quiz');
  };

  const handleSelect = (selectedIndex: number) => {
    setError(null);
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = selectedIndex;
      return next;
    });
    if (currentIndex < TOTAL_QUESTIONS - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setError(null);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSubmit = async () => {
    if (!tokenInfo || !publicToken) return;
    if (!allAnswered) {
      setError('Responda todas as perguntas antes de finalizar.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const scores = computeScores(answers);
      const { topProfile, topProfiles } = computeTopProfile(scores);
      const percentages = computePercentages(scores, TOTAL_QUESTIONS);

      const answersPayload: ArchetypeAnswer[] = answers.map((selectedIndex, idx) => {
        const safeIndex = selectedIndex ?? 0;
        const selectedWord = ARCHETYPE_QUESTIONS[idx][safeIndex];
        const scoredProfile = ARCHETYPE_PROFILES[safeIndex];
        return {
          questionId: idx + 1,
          selectedIndex: safeIndex,
          selectedWord,
          scoredProfile,
        };
      });

      await submitRespondent({
        clinic_id: tokenInfo.clinic_id,
        public_token: publicToken,
        audience_type: tokenInfo.audience_type,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        profession: form.profession.trim() || null,
        city: form.city.trim() || null,
        consent_lgpd: form.consent,
        scores,
        top_profile: topProfile,
        top_profiles: topProfile === 'EMPATE' ? topProfiles : null,
        answers: answersPayload,
      });

      const result: ArchetypeResult = {
        scores,
        percentages,
        topProfile,
        topProfiles,
      };

      if (typeof window !== 'undefined' && draftKey) {
        window.localStorage.removeItem(draftKey);
        window.localStorage.setItem(`archetypeResult:${publicToken}`, JSON.stringify(result));
      }

      navigate(`/public/perfil/${publicToken}/resultado`, { state: { result } });
    } catch (err) {
      console.error(err);
      setError('Não foi possível salvar suas respostas. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Carregando...</div>;
  }

  if (invalidToken || !publicToken || !tokenInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-8 max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-gray-800">Link inválido ou expirado</h1>
          <p className="text-sm text-gray-500">Peça um novo link para acessar o teste de perfil.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-800">Teste de Perfil Comportamental</h1>
          <p className="text-gray-500">Responda 40 perguntas e descubra seu perfil predominante.</p>
        </header>

        {step === 'intro' && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Antes de começar</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Nome *
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                WhatsApp
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Profissão
                <input
                  type="text"
                  value={form.profession}
                  onChange={(e) => setForm({ ...form, profession: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Cidade
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg"
                />
              </label>
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                className="mt-1"
              />
              <span>Concordo com o uso dos meus dados conforme a LGPD.</span>
            </label>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="button"
              onClick={handleStart}
              className="px-6 py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700"
            >
              Iniciar teste
            </button>
          </div>
        )}

        {step === 'quiz' && (
          <div className="space-y-6">
            <Progress current={answeredCount} total={TOTAL_QUESTIONS} label="Respondidas" />
            <QuestionCard
              index={currentIndex}
              total={TOTAL_QUESTIONS}
              options={ARCHETYPE_QUESTIONS[currentIndex] as unknown as string[]}
              selectedIndex={answers[currentIndex]}
              onSelect={handleSelect}
            />
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentIndex === 0}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 disabled:opacity-50"
              >
                Voltar
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{answeredCount}/{TOTAL_QUESTIONS} respondidas</span>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!allAnswered || submitting}
                  className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-medium disabled:opacity-50"
                >
                  {submitting ? 'Enviando...' : 'Finalizar teste'}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicArchetypeFormPage;
