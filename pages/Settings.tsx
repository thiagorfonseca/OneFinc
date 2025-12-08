import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, Loader2, CreditCard, User, CheckSquare, Upload, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Category } from '../types';

type Section = 'categorias' | 'taxas' | 'clientes' | 'procedimentos' | 'profissionais' | 'fornecedores';

const Settings: React.FC = () => {
  const [section, setSection] = useState<Section>('categorias');
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<'receita' | 'despesa'>('receita');
  const [clinicId, setClinicId] = useState<string | null>(null);

  // Form State - Categorias
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  // Form State - Taxas
  const [cardFees, setCardFees] = useState<any[]>([]);
  const [feeForm, setFeeForm] = useState({ bandeira: '', taxa_percent: '0', metodo: 'Cartão de Crédito', min_installments: '1', max_installments: '1' });
  const [addingFee, setAddingFee] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);

  // Form State - Clientes
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerForm, setCustomerForm] = useState({ name: '', cpf: '', cep: '' });
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

  // Form State - Clínicas
  // Procedimentos
  const [procedures, setProcedures] = useState<any[]>([]);
  const [procedureForm, setProcedureForm] = useState({ categoria: '', procedimento: '', valor_cobrado: '', custo_insumo: '', tempo_minutos: '' });
  const [editingProcedureId, setEditingProcedureId] = useState<string | null>(null);
  const [savingProcedure, setSavingProcedure] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [showProcedureModal, setShowProcedureModal] = useState(false);
  const [selectedProcedures, setSelectedProcedures] = useState<string[]>([]);
  const [procedureSearch, setProcedureSearch] = useState('');

  // Profissionais
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [professionalForm, setProfessionalForm] = useState({ nome: '', tipo: 'venda' });
  const [editingProfessionalId, setEditingProfessionalId] = useState<string | null>(null);
  const [savingProfessional, setSavingProfessional] = useState(false);

  // Fornecedores
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierForm, setSupplierForm] = useState({ nome: '', cnpj: '', telefone: '' });
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [savingSupplier, setSavingSupplier] = useState(false);

  const fetchProfileClinic = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const { data } = await supabase.from('profiles').select('clinic_id').eq('id', session.user.id).maybeSingle();
    if (data?.clinic_id) setClinicId(data.clinic_id);
  };

  const onlyDigits = (value: string) => value.replace(/\D/g, '');

  const isValidCPF = (cpf: string) => {
    const str = onlyDigits(cpf);
    if (str.length !== 11 || /^(\d)\1+$/.test(str)) return false;
    const calc = (base: number) => {
      let sum = 0;
      for (let i = 0; i < base; i++) sum += parseInt(str[i], 10) * (base + 1 - i);
      const mod = (sum * 10) % 11;
      return mod === 10 ? 0 : mod;
    };
    return calc(9) === parseInt(str[9], 10) && calc(10) === parseInt(str[10], 10);
  };

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCategories(data as any || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCardFees = async () => {
    const { data, error } = await supabase
      .from('card_fees')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setCardFees(data as any[]);
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setCustomers(data as any[]);
  };

  const fetchProcedures = async () => {
    const { data, error } = await supabase
      .from('procedures')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setProcedures(data as any[]);
  };

  const fetchProfessionals = async () => {
    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setProfessionals(data as any[]);
  };

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setSuppliers(data as any[]);
  };

  useEffect(() => {
    fetchProfileClinic();
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchCardFees();
    fetchCustomers();
    fetchProcedures();
    fetchProfessionals();
    fetchSuppliers();
  }, [clinicId]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    setAdding(true);
    try {
      if (editingCategoryId) {
        const { error } = await supabase.from('categories').update({
          name: newName
        }).eq('id', editingCategoryId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert([{
          name: newName,
          tipo: activeTab,
          cor_opcional: activeTab === 'receita' ? '#0ea5e9' : '#ef4444',
          clinic_id: clinicId
        }]);

        if (error) throw error;
      }
      
      setNewName('');
      setEditingCategoryId(null);
      fetchCategories();
    } catch (error: any) {
      alert('Erro ao criar: ' + error.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Excluir categoria?')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      if (editingCategoryId === id) {
        setEditingCategoryId(null);
        setNewName('');
      }
      fetchCategories();
    } catch (error: any) {
      alert('Erro: ' + error.message);
    }
  };

  const handleAddFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeForm.bandeira.trim()) return;
    const minI = parseInt(feeForm.min_installments || '1', 10) || 1;
    const maxI = parseInt(feeForm.max_installments || '1', 10) || 1;
    if (minI > maxI) {
      alert('Intervalo de parcelas inválido (mínimo maior que máximo).');
      return;
    }
    setAddingFee(true);
    try {
      const percent = parseFloat(feeForm.taxa_percent.replace(',', '.')) || 0;
      if (editingFeeId) {
        const { error } = await supabase.from('card_fees').update({
          bandeira: feeForm.bandeira,
          taxa_percent: percent,
          metodo: feeForm.metodo,
          min_installments: minI,
          max_installments: maxI,
          clinic_id: clinicId
        }).eq('id', editingFeeId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('card_fees').insert([{
          bandeira: feeForm.bandeira,
          taxa_percent: percent,
          metodo: feeForm.metodo,
          min_installments: minI,
          max_installments: maxI,
          clinic_id: clinicId
        }]);
        if (error) throw error;
      }
      setFeeForm({ bandeira: '', taxa_percent: '0', metodo: 'Cartão de Crédito', min_installments: '1', max_installments: '1' });
      setEditingFeeId(null);
      fetchCardFees();
    } catch (err: any) {
      alert('Erro ao salvar taxa: ' + err.message);
    } finally {
      setAddingFee(false);
    }
  };

  const handleDeleteFee = async (id: string) => {
    if (!confirm('Excluir taxa?')) return;
    const { error } = await supabase.from('card_fees').delete().eq('id', id);
    if (!error) {
      if (editingFeeId === id) {
        setEditingFeeId(null);
        setFeeForm({ bandeira: '', taxa_percent: '0', metodo: 'Cartão de Crédito', min_installments: '1', max_installments: '1' });
      }
      fetchCardFees();
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerError(null);
    if (!customerForm.name.trim()) return;
    const cpfDigits = onlyDigits(customerForm.cpf);
    const cepDigits = onlyDigits(customerForm.cep);
    if (cpfDigits && !isValidCPF(cpfDigits)) {
      setCustomerError('CPF inválido.');
      return;
    }
    if (cepDigits && cepDigits.length !== 8) {
      setCustomerError('CEP inválido (use 8 dígitos).');
      return;
    }

    // Checar duplicidade de CPF
    if (cpfDigits) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('cpf', cpfDigits)
        .maybeSingle();
      if (existing && existing.id !== editingCustomerId) {
        setCustomerError('CPF já cadastrado.');
        return;
      }
    }

    setAddingCustomer(true);
    try {
      if (editingCustomerId) {
        const { error } = await supabase.from('customers').update({
          name: customerForm.name,
          cpf: cpfDigits || null,
          cep: cepDigits || null,
          clinic_id: clinicId
        }).eq('id', editingCustomerId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('customers').insert([{
          name: customerForm.name,
          cpf: cpfDigits || null,
          cep: cepDigits || null,
          clinic_id: clinicId
        }]);
        if (error) throw error;
      }
      setCustomerForm({ name: '', cpf: '', cep: '' });
      setEditingCustomerId(null);
      fetchCustomers();
    } catch (err: any) {
      alert('Erro ao salvar cliente: ' + err.message);
    } finally {
      setAddingCustomer(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Excluir cliente?')) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (!error) {
      if (editingCustomerId === id) {
        setEditingCustomerId(null);
        setCustomerForm({ name: '', cpf: '', cep: '' });
      }
      fetchCustomers();
    }
  };

  const filteredCategories = categories.filter(c => (c as any).tipo === activeTab);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
        <p className="text-gray-500">Cadastre categorias, taxas, clientes e clínicas</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSection('categorias')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${section === 'categorias' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
        >
          Categorias
        </button>
        <button
          onClick={() => setSection('taxas')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${section === 'taxas' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
        >
          Taxas de Cartão
        </button>
        <button
          onClick={() => setSection('clientes')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${section === 'clientes' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
        >
          Clientes
        </button>
        <button
          onClick={() => setSection('procedimentos')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${section === 'procedimentos' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
        >
          Procedimentos
        </button>
        <button
          onClick={() => setSection('profissionais')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${section === 'profissionais' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
        >
          Profissionais
        </button>
        <button
          onClick={() => setSection('fornecedores')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${section === 'fornecedores' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
        >
          Fornecedores
        </button>
      </div>

      {/* Categorias */}
      {section === 'categorias' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button 
              onClick={() => setActiveTab('receita')}
              className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'receita' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Categorias de Receitas
            </button>
            <button 
              onClick={() => setActiveTab('despesa')}
              className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'despesa' ? 'text-red-600 border-b-2 border-red-600 bg-red-50' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Categorias de Despesas
            </button>
          </div>

          <div className="p-6">
            <form onSubmit={handleAddCategory} className="flex gap-3 mb-8">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder={`Nova categoria de ${activeTab}...`}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <button 
                type="submit" 
                disabled={adding || !newName.trim()}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
              >
                {adding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                {editingCategoryId ? 'Atualizar' : 'Adicionar'}
              </button>
            </form>

            {loading ? (
              <div className="text-center py-8 text-gray-400">Carregando...</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filteredCategories.map(cat => (
                  <li key={cat.id} className="py-3 flex items-center justify-between hover:bg-gray-50 px-2 rounded-lg -mx-2 transition-colors">
                    <span className="font-medium text-gray-700">{cat.name}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditingCategoryId(cat.id); setNewName(cat.name); }}
                        className="text-xs text-gray-500 hover:text-brand-600"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
                {filteredCategories.length === 0 && (
                  <li className="text-center py-8 text-gray-400 italic">Nenhuma categoria cadastrada.</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Taxas de Cartão */}
      {section === 'taxas' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><CreditCard size={18}/> Taxas por Bandeira</h2>
              <p className="text-sm text-gray-500">Cadastre a taxa (%) por bandeira de cartão de crédito.</p>
            </div>
          </div>

          <form onSubmit={handleAddFee} className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bandeira</label>
              <input
                required
                value={feeForm.bandeira}
                onChange={e => setFeeForm({ ...feeForm, bandeira: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="Ex: Visa, Master, Elo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Taxa (%)</label>
              <input
                required
                type="number"
                step="0.01"
                value={feeForm.taxa_percent}
                onChange={e => setFeeForm({ ...feeForm, taxa_percent: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas (mín)</label>
              <input
                required
                type="number"
                min="1"
                value={feeForm.min_installments}
                onChange={e => setFeeForm({ ...feeForm, min_installments: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas (máx)</label>
              <input
                required
                type="number"
                min="1"
                value={feeForm.max_installments}
                onChange={e => setFeeForm({ ...feeForm, max_installments: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={addingFee}
                className="w-full px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 justify-center"
              >
                {addingFee ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {editingFeeId ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cardFees.map(fee => (
              <div key={fee.id} className="border border-gray-100 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{fee.bandeira}</p>
                  <p className="text-sm text-gray-500">{fee.metodo} • {fee.min_installments}x até {fee.max_installments}x</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-brand-600 font-bold">{fee.taxa_percent}%</span>
                  <button
                    onClick={() => {
                      setEditingFeeId(fee.id);
                      setFeeForm({
                        bandeira: fee.bandeira,
                        taxa_percent: String(fee.taxa_percent),
                        metodo: fee.metodo,
                        min_installments: String(fee.min_installments || 1),
                        max_installments: String(fee.max_installments || 1)
                      });
                    }}
                    className="text-gray-400 hover:text-brand-600"
                  >
                    Editar
                  </button>
                  <button onClick={() => handleDeleteFee(fee.id)} className="text-gray-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {cardFees.length === 0 && (
              <div className="text-sm text-gray-400">Nenhuma taxa cadastrada.</div>
            )}
          </div>
        </div>
      )}

      {/* Clientes */}
      {section === 'clientes' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><User size={18}/> Clientes</h2>
              <p className="text-sm text-gray-500">Registre clientes com CPF e CEP para relacionar aos lançamentos.</p>
            </div>
          </div>

          <form onSubmit={handleAddCustomer} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                required
                value={customerForm.name}
                onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
              <input
                value={customerForm.cpf}
                onChange={e => setCustomerForm({ ...customerForm, cpf: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="Somente números"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
              <input
                value={customerForm.cep}
                onChange={e => setCustomerForm({ ...customerForm, cep: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="00000-000"
              />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button
                type="submit"
                disabled={addingCustomer}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
              >
                {addingCustomer ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {editingCustomerId ? 'Atualizar Cliente' : 'Salvar Cliente'}
              </button>
            </div>
          </form>
          {customerError && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{customerError}</div>
          )}

          <div className="border border-gray-100 rounded-lg divide-y">
            {customers.map(c => (
              <div key={c.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-500">CPF: {c.cpf || '-'} • CEP: {c.cep || '-'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingCustomerId(c.id);
                      setCustomerForm({ name: c.name || '', cpf: c.cpf || '', cep: c.cep || '' });
                    }}
                    className="text-gray-400 hover:text-brand-600 text-sm"
                  >
                    Editar
                  </button>
                  <button onClick={() => handleDeleteCustomer(c.id)} className="text-gray-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {customers.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center">Nenhum cliente cadastrado.</div>
            )}
          </div>
        </div>
      )}


      {/* Procedimentos */}
      {section === 'procedimentos' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><CheckSquare size={16}/> Procedimentos realizados</h2>
              <p className="text-sm text-gray-500">Cadastre procedimentos individualmente ou importe via CSV.</p>
            </div>
            <div className="flex gap-2">
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent('#,Categoria,Procedimento,Custo insumo,Tempo (min),Valor cobrado\n1,Consulta,Consulta Geral,50,30,200')}`}
                download="modelo_procedimentos.csv"
                className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg flex items-center gap-2"
              >
                <Download size={14}/> Modelo CSV
              </a>
              <label className={`px-3 py-2 text-sm bg-brand-600 text-white rounded-lg flex items-center gap-2 cursor-pointer hover:bg-brand-700 ${uploadingCsv ? 'opacity-60 pointer-events-none' : ''}`}>
                <Upload size={14}/> {uploadingCsv ? 'Importando...' : 'Importar CSV'}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (e) => {
                    if (!e.target.files?.length) return;
                    const file = e.target.files[0];
                    setUploadingCsv(true);
                    try {
                      const text = (await file.text()).replace(/^\uFEFF/, ''); // remove BOM
                      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
                      if (!lines.length) throw new Error('Arquivo vazio');

                      // Detecta separador por frequência
                      const first = lines[0];
                      const commaCount = (first.match(/,/g) || []).length;
                      const semicolonCount = (first.match(/;/g) || []).length;
                      const separator = semicolonCount > commaCount ? ';' : ',';

                      const parseLine = (line: string) => {
                        const out: string[] = [];
                        let current = '';
                        let insideQuotes = false;
                        for (let i = 0; i < line.length; i++) {
                          const ch = line[i];
                          if (ch === '"') {
                            // alterna estado de aspas
                            insideQuotes = !insideQuotes;
                            continue;
                          }
                          if (ch === separator && !insideQuotes) {
                            out.push(current);
                            current = '';
                          } else {
                            current += ch;
                          }
                        }
                        out.push(current);
                        return out.map(s => s.trim());
                      };

                      const header = parseLine(first).map(h => h.toLowerCase());
                      const hasHeader = header.some(h => h.includes('procedimento') || h.includes('categoria'));
                      const dataLines = hasHeader ? lines.slice(1) : lines;

                      // mapa de colunas: modelo esperado "#,Categoria,Procedimento,Custo insumo,Tempo (min),Valor cobrado"
                      const findIdx = (needle: string[]) => {
                        const idx = header.findIndex(h => needle.some(n => h.includes(n)));
                        return idx >= 0 ? idx : -1;
                      };
                      const idxCategoria = hasHeader ? findIdx(['categoria']) : -1;
                      const idxProcedimento = hasHeader ? findIdx(['procedimento']) : -1;
                      const idxCusto = hasHeader ? findIdx(['custo']) : -1;
                      const idxTempo = hasHeader ? findIdx(['tempo']) : -1;
                      const idxValor = hasHeader ? findIdx(['valor']) : -1;

                      const payload = dataLines.map(r => {
                        const cols = parseLine(r);
                        // fallback: se vier sem cabeçalho, assume posição com possível coluna "#" na frente
                        const shift = !hasHeader && cols.length >= 6 ? 1 : 0;

                        const valToNumber = (v?: string | null) => {
                          if (v === undefined || v === null || v === '') return null;
                          const normalized = v.replace(/\./g, '').replace(',', '.');
                          const num = Number(normalized);
                          return Number.isFinite(num) ? num : null;
                        };

                        const pick = (idxHeader: number, fallback: number) => {
                          const idx = idxHeader >= 0 ? idxHeader : fallback;
                          return cols[idx] ?? '';
                        };

                        const categoria = pick(idxCategoria, shift + 0);
                        const procedimento = pick(idxProcedimento, shift + 1);
                        const custo = pick(idxCusto, shift + 2);
                        const tempo = pick(idxTempo, shift + 3);
                        const valor = pick(idxValor, shift + 4);

                        return {
                          categoria: categoria || null,
                          procedimento: procedimento || null,
                          custo_insumo: valToNumber(custo),
                          tempo_minutos: valToNumber(tempo),
                          valor_cobrado: valToNumber(valor),
                          clinic_id: clinicId,
                        };
                      }).filter(p => p.procedimento);
                      if (payload.length) {
                        const { error } = await supabase.from('procedures').insert(payload);
                        if (error) throw error;
                        fetchProcedures();
                      } else {
                        alert('Nenhuma linha válida encontrada no CSV.');
                      }
                    } catch (err: any) {
                      alert('Erro ao importar CSV: ' + err.message);
                    } finally {
                      setUploadingCsv(false);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-between items-center">
            <input
              type="text"
              value={procedureSearch}
              onChange={e => setProcedureSearch(e.target.value)}
              placeholder="Buscar procedimento..."
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 flex-1 min-w-[220px]"
            />
            <button
              onClick={async () => {
                if (!selectedProcedures.length) return;
                if (!confirm('Apagar procedimentos selecionados?')) return;
                const { error } = await supabase.from('procedures').delete().in('id', selectedProcedures);
                if (!error) {
                  setSelectedProcedures([]);
                  fetchProcedures();
                }
              }}
              className="px-4 py-2 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm mr-2 disabled:opacity-50"
              disabled={!selectedProcedures.length}
            >
              Apagar selecionados
            </button>
            <button
              onClick={() => { setEditingProcedureId(null); setProcedureForm({ categoria: '', procedimento: '', valor_cobrado: '', custo_insumo: '', tempo_minutos: '' }); setShowProcedureModal(true); }}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2"
            >
              <Plus size={16}/> Novo procedimento
            </button>
          </div>

          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b">
                <tr>
                  <th className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedProcedures.length > 0 && selectedProcedures.length === procedures.length}
                      onChange={e => {
                        if (e.target.checked) setSelectedProcedures(procedures.map(p => p.id));
                        else setSelectedProcedures([]);
                      }}
                    />
                  </th>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Categoria</th>
                  <th className="px-4 py-2 text-left">Procedimento</th>
                  <th className="px-4 py-2 text-left">Custo insumo</th>
                  <th className="px-4 py-2 text-left">Tempo (min)</th>
                  <th className="px-4 py-2 text-left">Valor cobrado</th>
                  <th className="px-4 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {procedures
                  .filter(p => p.procedimento?.toLowerCase().includes(procedureSearch.toLowerCase()))
                  .map((p, idx) => {
                  const selected = selectedProcedures.includes(p.id);
                  return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={e => {
                          if (e.target.checked) setSelectedProcedures(prev => [...prev, p.id]);
                          else setSelectedProcedures(prev => prev.filter(id => id !== p.id));
                        }}
                      />
                    </td>
                    <td className="px-4 py-2 text-gray-700">{idx + 1}</td>
                    <td className="px-4 py-2 text-gray-700">{p.categoria || '-'}</td>
                    <td className="px-4 py-2 font-semibold text-gray-800">{p.procedimento}</td>
                    <td className="px-4 py-2 text-gray-700">{p.custo_insumo ?? '-'}</td>
                    <td className="px-4 py-2 text-gray-700">{p.tempo_minutos ?? '-'}</td>
                    <td className="px-4 py-2 text-gray-700">{p.valor_cobrado ?? '-'}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => {
                          setEditingProcedureId(p.id);
                          setProcedureForm({
                            categoria: p.categoria || '',
                            procedimento: p.procedimento || '',
                            valor_cobrado: p.valor_cobrado || '',
                            custo_insumo: p.custo_insumo || '',
                            tempo_minutos: p.tempo_minutos || '',
                          });
                          setShowProcedureModal(true);
                        }}
                        className="text-brand-600 text-sm mr-3"
                      >
                        Editar
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Excluir procedimento?')) return;
                          const { error } = await supabase.from('procedures').delete().eq('id', p.id);
                          if (!error) fetchProcedures();
                        }}
                        className="text-red-600 text-sm"
                      >
                        Apagar
                      </button>
                    </td>
                  </tr>
                  );
                })}
                {procedures.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-400">Nenhum procedimento cadastrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {showProcedureModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-800">{editingProcedureId ? 'Editar procedimento' : 'Novo procedimento'}</h4>
                  <button
                    onClick={() => { setShowProcedureModal(false); setEditingProcedureId(null); }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <form
                  onSubmit={async (ev) => {
                    ev.preventDefault();
                    if (!procedureForm.procedimento.trim()) return;
                    setSavingProcedure(true);
                    try {
                      const payload = {
                        categoria: procedureForm.categoria || null,
                        procedimento: procedureForm.procedimento,
                        valor_cobrado: procedureForm.valor_cobrado ? Number(procedureForm.valor_cobrado) : null,
                        custo_insumo: procedureForm.custo_insumo ? Number(procedureForm.custo_insumo) : null,
                        tempo_minutos: procedureForm.tempo_minutos ? Number(procedureForm.tempo_minutos) : null,
                        clinic_id: clinicId,
                      };
                      if (editingProcedureId) {
                        const { error } = await supabase.from('procedures').update(payload).eq('id', editingProcedureId);
                        if (error) throw error;
                      } else {
                        const { error } = await supabase.from('procedures').insert([payload]);
                        if (error) throw error;
                      }
                      setProcedureForm({ categoria: '', procedimento: '', valor_cobrado: '', custo_insumo: '', tempo_minutos: '' });
                      setEditingProcedureId(null);
                      setShowProcedureModal(false);
                      fetchProcedures();
                    } catch (err: any) {
                      alert('Erro ao salvar procedimento: ' + err.message);
                    } finally {
                      setSavingProcedure(false);
                    }
                  }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                    <input
                      value={procedureForm.categoria}
                      onChange={e => setProcedureForm({ ...procedureForm, categoria: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                      placeholder="Ex: Consulta"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Procedimento</label>
                    <input
                      required
                      value={procedureForm.procedimento}
                      onChange={e => setProcedureForm({ ...procedureForm, procedimento: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                      placeholder="Nome do procedimento"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor cobrado</label>
                    <input
                      type="number"
                      value={procedureForm.valor_cobrado}
                      onChange={e => setProcedureForm({ ...procedureForm, valor_cobrado: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Custo insumo</label>
                    <input
                      type="number"
                      value={procedureForm.custo_insumo}
                      onChange={e => setProcedureForm({ ...procedureForm, custo_insumo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tempo (min)</label>
                    <input
                      type="number"
                      value={procedureForm.tempo_minutos}
                      onChange={e => setProcedureForm({ ...procedureForm, tempo_minutos: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowProcedureModal(false); setEditingProcedureId(null); }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingProcedure}
                      className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {savingProcedure ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      {editingProcedureId ? 'Atualizar' : 'Salvar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Profissionais */}
      {section === 'profissionais' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><User size={16}/> Profissionais</h2>
              <p className="text-sm text-gray-500">Cadastre profissionais para venda e execução.</p>
            </div>
          </div>
          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              if (!professionalForm.nome.trim()) return;
              setSavingProfessional(true);
              try {
                if (editingProfessionalId) {
                  const { error } = await supabase.from('professionals').update({
                    nome: professionalForm.nome,
                    tipo: professionalForm.tipo,
                    clinic_id: clinicId,
                  }).eq('id', editingProfessionalId);
                  if (error) throw error;
                } else {
                  const { error } = await supabase.from('professionals').insert([{
                    nome: professionalForm.nome,
                    tipo: professionalForm.tipo,
                    clinic_id: clinicId,
                  }]);
                  if (error) throw error;
                }
                setProfessionalForm({ nome: '', tipo: 'venda' });
                setEditingProfessionalId(null);
                fetchProfessionals();
              } catch (err: any) {
                alert('Erro ao salvar profissional: ' + err.message);
              } finally {
                setSavingProfessional(false);
              }
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                value={professionalForm.nome}
                onChange={e => setProfessionalForm({ ...professionalForm, nome: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="Nome do profissional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={professionalForm.tipo}
                onChange={e => setProfessionalForm({ ...professionalForm, tipo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
              >
                <option value="venda">Venda</option>
                <option value="execucao">Execução</option>
              </select>
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={savingProfessional}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingProfessional ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {editingProfessionalId ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </form>

          <div className="border border-gray-100 rounded-lg divide-y">
            {professionals.map((p) => (
              <div key={p.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{p.nome}</p>
                  <p className="text-xs text-gray-500">Tipo: {p.tipo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingProfessionalId(p.id);
                      setProfessionalForm({ nome: p.nome || '', tipo: p.tipo || 'venda' });
                    }}
                    className="text-sm text-brand-600"
                  >
                    Editar
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('Excluir profissional?')) return;
                      const { error } = await supabase.from('professionals').delete().eq('id', p.id);
                      if (!error) fetchProfessionals();
                    }}
                    className="text-sm text-red-600"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            ))}
            {professionals.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center">Nenhum profissional cadastrado.</div>
            )}
          </div>
        </div>
      )}

      {/* Fornecedores */}
      {section === 'fornecedores' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><User size={16}/> Fornecedores</h2>
              <p className="text-sm text-gray-500">Cadastre fornecedores para usar no lançamento de despesas.</p>
            </div>
          </div>
          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              if (!supplierForm.nome.trim()) return;
              setSavingSupplier(true);
              try {
                if (editingSupplierId) {
                  const { error } = await supabase.from('suppliers').update({
                    nome: supplierForm.nome,
                    cnpj: supplierForm.cnpj,
                    telefone: supplierForm.telefone,
                    clinic_id: clinicId,
                  }).eq('id', editingSupplierId);
                  if (error) throw error;
                } else {
                  const { error } = await supabase.from('suppliers').insert([{
                    nome: supplierForm.nome,
                    cnpj: supplierForm.cnpj,
                    telefone: supplierForm.telefone,
                    clinic_id: clinicId,
                  }]);
                  if (error) throw error;
                }
                setSupplierForm({ nome: '', cnpj: '', telefone: '' });
                setEditingSupplierId(null);
                fetchSuppliers();
              } catch (err: any) {
                alert('Erro ao salvar fornecedor: ' + err.message);
              } finally {
                setSavingSupplier(false);
              }
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa</label>
              <input
                value={supplierForm.nome}
                onChange={e => setSupplierForm({ ...supplierForm, nome: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="Fornecedor Ltda"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
              <input
                value={supplierForm.cnpj}
                onChange={e => setSupplierForm({ ...supplierForm, cnpj: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="Somente números"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                value={supplierForm.telefone}
                onChange={e => setSupplierForm({ ...supplierForm, telefone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={savingSupplier}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingSupplier ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {editingSupplierId ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </form>

          <div className="border border-gray-100 rounded-lg divide-y">
            {suppliers.map((s) => (
              <div key={s.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{s.nome}</p>
                  <p className="text-xs text-gray-500">CNPJ: {s.cnpj || '-'} • Tel: {s.telefone || '-'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingSupplierId(s.id);
                      setSupplierForm({ nome: s.nome || '', cnpj: s.cnpj || '', telefone: s.telefone || '' });
                    }}
                    className="text-sm text-brand-600"
                  >
                    Editar
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('Excluir fornecedor?')) return;
                      const { error } = await supabase.from('suppliers').delete().eq('id', s.id);
                      if (!error) fetchSuppliers();
                    }}
                    className="text-sm text-red-600"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            ))}
            {suppliers.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center">Nenhum fornecedor cadastrado.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
