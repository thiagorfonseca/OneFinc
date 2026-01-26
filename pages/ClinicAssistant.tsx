import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/supabase';
import { useAuth } from '../src/auth/AuthProvider';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

const ClinicAssistant: React.FC = () => {
  const { user, effectiveClinicId } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const canChat = useMemo(() => !!user?.id && !!effectiveClinicId, [user?.id, effectiveClinicId]);
  const assistantEndpoint = useMemo(() => {
    const base = SUPABASE_URL.replace(/\/+$/, '');
    return `${base}/functions/v1/clinic-assistant`;
  }, []);

  const loadMessages = async () => {
    if (!user?.id || !effectiveClinicId) return;
    setLoadingHistory(true);
    const { data, error: fetchError } = await supabase
      .from('ai_chat_messages')
      .select('id, role, content, created_at')
      .eq('clinic_id', effectiveClinicId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(200);
    if (fetchError) {
      setError(fetchError.message);
      setLoadingHistory(false);
      return;
    }
    setMessages((data || []) as ChatMessage[]);
    setLoadingHistory(false);
  };

  useEffect(() => {
    loadMessages();
  }, [user?.id, effectiveClinicId]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!canChat) {
      setError('Selecione uma clínica válida para usar o assistente.');
      return;
    }
    setError(null);
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed, created_at: new Date().toISOString() }]);
    setIsTyping(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const response = await fetch(assistantEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ message: trimmed, clinic_id: effectiveClinicId }),
      });

      const rawText = await response.text();
      let payload: any = null;
      if (rawText) {
        try {
          payload = JSON.parse(rawText);
        } catch {
          payload = null;
        }
      }
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || rawText || 'Erro ao consultar assistente.');
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: payload.answer, created_at: new Date().toISOString() },
      ]);
      await loadMessages();
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar mensagem.');
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Assistente IA da Clínica</h1>
        <p className="text-gray-500">Pergunte sobre recebíveis, despesas e projeções financeiras.</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-3">
        {!canChat && (
          <div className="text-sm text-gray-500">
            Selecione uma clínica ativa para usar o assistente.
          </div>
        )}
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 flex flex-col h-[520px]">
        <div ref={listRef} className="flex-1 overflow-y-auto space-y-3 pr-2">
          {loadingHistory && (
            <div className="text-sm text-gray-400">Carregando histórico...</div>
          )}
          {!loadingHistory && messages.length === 0 && (
            <div className="text-sm text-gray-400">Comece uma conversa para ver respostas financeiras.</div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={msg.id || idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 bg-gray-100 text-gray-600 rounded-2xl px-4 py-3 text-sm">
                <Sparkles size={16} className="animate-pulse" /> Digitando...
              </div>
            </div>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="mt-4 flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua pergunta financeira..."
            className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500"
            disabled={!canChat || isTyping}
          />
          <button
            type="submit"
            disabled={!canChat || isTyping}
            className="px-4 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Send size={16} /> Enviar
          </button>
        </form>
      </div>
    </div>
  );
};

export default ClinicAssistant;
