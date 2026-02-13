import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

const initialForm = {
  company: {
    legal_name: '',
    trade_name: '',
    cnpj: '',
    state_registration: '',
    email_principal: '',
    email_financeiro: '',
    telefone: '',
    whatsapp: '',
    address: {
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      uf: '',
      cep: '',
    },
  },
  responsible: {
    name: '',
    cpf: '',
    email: '',
    telefone: '',
  },
};

const PublicProposalForm: React.FC = () => {
  const { token } = useParams();
  const [proposal, setProposal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');

  const trimValue = (value: string) => value.trim();
  const digitsOnly = (value: string) => value.replace(/\D/g, '');
  const isEmail = (value: string) => /\S+@\S+\.\S+/.test(trimValue(value));
  const hasValue = (value: string) => trimValue(value).length > 0;

  const isStep1Valid = useMemo(() => {
    return (
      hasValue(form.company.legal_name) &&
      digitsOnly(form.company.cnpj).length >= 8 &&
      isEmail(form.company.email_principal) &&
      hasValue(form.company.telefone) &&
      hasValue(form.company.address.logradouro) &&
      hasValue(form.company.address.numero) &&
      hasValue(form.company.address.bairro) &&
      hasValue(form.company.address.cidade) &&
      trimValue(form.company.address.uf).length === 2 &&
      digitsOnly(form.company.address.cep).length >= 8
    );
  }, [form]);

  const isStep2Valid = useMemo(() => {
    return (
      hasValue(form.responsible.name) &&
      digitsOnly(form.responsible.cpf).length >= 8 &&
      isEmail(form.responsible.email) &&
      hasValue(form.responsible.telefone)
    );
  }, [form]);

  const isFormValid = isStep1Valid && isStep2Valid;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/public/proposals/${token}`);
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) {
          setError('Proposta não encontrada.');
          return;
        }
        if (!contentType.includes('application/json')) {
          setError('API indisponível no momento. Tente novamente em alguns minutos.');
          return;
        }
        const data = await res.json();
        setProposal(data.proposal);
      } catch {
        setError('Erro ao carregar proposta.');
      } finally {
        setLoading(false);
      }
    };
    if (token) load();
  }, [token]);

  useEffect(() => {
    if (error) setError('');
  }, [form]);

  const nextDisabled = useMemo(() => {
    if (step === 1) return !isStep1Valid;
    if (step === 2) return !isStep2Valid;
    return false;
  }, [step, isStep1Valid, isStep2Valid]);

  const handleSubmit = async () => {
    if (!isFormValid) {
      setError('Preencha todos os campos obrigatórios antes de continuar.');
      return;
    }
    setSending(true);
    setError('');
    const payload = {
      company: {
        ...form.company,
        legal_name: trimValue(form.company.legal_name),
        trade_name: trimValue(form.company.trade_name),
        cnpj: trimValue(form.company.cnpj),
        state_registration: trimValue(form.company.state_registration),
        email_principal: trimValue(form.company.email_principal),
        email_financeiro: trimValue(form.company.email_financeiro),
        telefone: trimValue(form.company.telefone),
        whatsapp: trimValue(form.company.whatsapp),
        address: {
          ...form.company.address,
          logradouro: trimValue(form.company.address.logradouro),
          numero: trimValue(form.company.address.numero),
          complemento: trimValue(form.company.address.complemento),
          bairro: trimValue(form.company.address.bairro),
          cidade: trimValue(form.company.address.cidade),
          uf: trimValue(form.company.address.uf).toUpperCase(),
          cep: trimValue(form.company.address.cep),
        },
      },
      responsible: {
        ...form.responsible,
        name: trimValue(form.responsible.name),
        cpf: trimValue(form.responsible.cpf),
        email: trimValue(form.responsible.email),
        telefone: trimValue(form.responsible.telefone),
      },
    };
    const res = await fetch(`/api/public/proposals/${token}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      if (data?.details?.fieldErrors) {
        setError('Preencha todos os campos obrigatórios antes de continuar.');
      } else {
        setError(data?.error || 'Erro ao enviar formulário.');
      }
      return;
    }
    if (data.next === 'signature' && data.signUrl) {
      window.location.href = data.signUrl;
      return;
    }
    window.location.href = `/pagamento/${token}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <div className="max-w-3xl w-full space-y-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <h1 className="text-2xl font-bold text-gray-800">{proposal?.title || 'Cadastro'}</h1>
          <p className="text-gray-500">Preencha os dados para concluir sua proposta.</p>
          <div className="mt-4 flex items-center gap-3 text-sm text-gray-600">
            <CheckCircle size={16} className="text-emerald-600" />
            Valor: {formatCurrency((proposal?.amount_cents || 0) / 100)}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Etapa {step} de 3</span>
            <div className="flex gap-2">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`h-2 w-12 rounded-full ${idx <= step ? 'bg-brand-600' : 'bg-gray-200'}`}
                />
              ))}
            </div>
          </div>

          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                placeholder="Razão social"
                value={form.company.legal_name}
                onChange={(e) => setForm((prev) => ({ ...prev, company: { ...prev.company, legal_name: e.target.value } }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="Nome fantasia"
                value={form.company.trade_name}
                onChange={(e) => setForm((prev) => ({ ...prev, company: { ...prev.company, trade_name: e.target.value } }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="CNPJ"
                value={form.company.cnpj}
                onChange={(e) => setForm((prev) => ({ ...prev, company: { ...prev.company, cnpj: e.target.value } }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="Inscrição estadual"
                value={form.company.state_registration}
                onChange={(e) => setForm((prev) => ({ ...prev, company: { ...prev.company, state_registration: e.target.value } }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="Email principal"
                value={form.company.email_principal}
                onChange={(e) => setForm((prev) => ({ ...prev, company: { ...prev.company, email_principal: e.target.value } }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="Email financeiro"
                value={form.company.email_financeiro}
                onChange={(e) => setForm((prev) => ({ ...prev, company: { ...prev.company, email_financeiro: e.target.value } }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="Telefone"
                value={form.company.telefone}
                onChange={(e) => setForm((prev) => ({ ...prev, company: { ...prev.company, telefone: e.target.value } }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="WhatsApp"
                value={form.company.whatsapp}
                onChange={(e) => setForm((prev) => ({ ...prev, company: { ...prev.company, whatsapp: e.target.value } }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="Logradouro"
                value={form.company.address.logradouro}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    company: { ...prev.company, address: { ...prev.company.address, logradouro: e.target.value } },
                  }))
                }
                className="px-3 py-2 border border-gray-200 rounded-lg md:col-span-2"
              />
              <input
                placeholder="Número"
                value={form.company.address.numero}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    company: { ...prev.company, address: { ...prev.company.address, numero: e.target.value } },
                  }))
                }
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="Complemento"
                value={form.company.address.complemento}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    company: { ...prev.company, address: { ...prev.company.address, complemento: e.target.value } },
                  }))
                }
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="Bairro"
                value={form.company.address.bairro}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    company: { ...prev.company, address: { ...prev.company.address, bairro: e.target.value } },
                  }))
                }
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="Cidade"
                value={form.company.address.cidade}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    company: { ...prev.company, address: { ...prev.company.address, cidade: e.target.value } },
                  }))
                }
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="UF"
                value={form.company.address.uf}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    company: { ...prev.company, address: { ...prev.company.address, uf: e.target.value } },
                  }))
                }
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="CEP"
                value={form.company.address.cep}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    company: { ...prev.company, address: { ...prev.company.address, cep: e.target.value } },
                  }))
                }
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                placeholder="Nome do responsável"
                value={form.responsible.name}
                onChange={(e) => setForm((prev) => ({ ...prev, responsible: { ...prev.responsible, name: e.target.value } }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="CPF"
                value={form.responsible.cpf}
                onChange={(e) => setForm((prev) => ({ ...prev, responsible: { ...prev.responsible, cpf: e.target.value } }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="Email"
                value={form.responsible.email}
                onChange={(e) => setForm((prev) => ({ ...prev, responsible: { ...prev.responsible, email: e.target.value } }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
              <input
                placeholder="Telefone"
                value={form.responsible.telefone}
                onChange={(e) => setForm((prev) => ({ ...prev, responsible: { ...prev.responsible, telefone: e.target.value } }))}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-sm text-gray-600">
              <div>
                <h3 className="font-semibold text-gray-700">Empresa</h3>
                <p>{form.company.legal_name} ({form.company.trade_name})</p>
                <p>{form.company.email_principal}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700">Responsável</h3>
                <p>{form.responsible.name} • {form.responsible.email}</p>
              </div>
            </div>
          )}

          {error ? <div className="text-sm text-rose-500">{error}</div> : null}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((prev) => Math.max(1, prev - 1))}
              disabled={step === 1}
              className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg disabled:opacity-40"
            >
              Voltar
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => prev + 1)}
                disabled={nextDisabled}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
              >
                Continuar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={sending}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {sending ? 'Enviando...' : 'Confirmar e enviar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProposalForm;
