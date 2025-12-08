import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, PlusCircle, Link as LinkIcon, Loader2 } from 'lucide-react';
import { parseOFX, formatCurrency, formatDate } from '../lib/utils';
import { BankAccount, Category } from '../types';
import { supabase } from '../lib/supabase';

const Reconciliation: React.FC = () => {
  // State
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Data State
  const [bankTransactions, setBankTransactions] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null); // Transaction being conciliated
  const [categories, setCategories] = useState<Category[]>([]);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    category_id: '',
    description: '',
    entity_name: '' // Fornecedor/Paciente
  });

  // 1. Initial Load: Accounts & Categories
  useEffect(() => {
    const init = async () => {
      const { data: accs } = await supabase.from('bank_accounts').select('*');
      const { data: cats } = await supabase.from('categories').select('*');
      if (accs) setAccounts(accs as any);
      if (cats) setCategories(cats as any);
    };
    init();
  }, []);

  // 2. Fetch Bank Transactions from DB when account changes
  useEffect(() => {
    if (selectedAccountId) fetchBankTransactions();
  }, [selectedAccountId]);

  const fetchBankTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('bank_account_id', selectedAccountId)
        .order('data', { ascending: false });

      if (error) throw error;
      setBankTransactions(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle File Upload & Save to DB
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedAccountId) {
      alert("Selecione uma conta bancária antes de importar o arquivo.");
      return;
    }

    const file = event.target.files?.[0];
    if (file) {
      setLoading(true);
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          const parsed = parseOFX(text);
          let addedCount = 0;
          let dupCount = 0;

          // Process each transaction
          for (const tx of parsed) {
            // Check existence by hash
            const { data: existing } = await supabase
              .from('bank_transactions')
              .select('id')
              .eq('hash_transacao', tx.hash)
              .eq('bank_account_id', selectedAccountId) // Hash should be unique per account ideally
              .maybeSingle();

            if (!existing) {
              await supabase.from('bank_transactions').insert([{
                bank_account_id: selectedAccountId,
                data: tx.date,
                descricao: tx.description,
                valor: tx.amount,
                tipo: tx.type,
                hash_transacao: tx.hash,
                conciliado: false
              }]);
              addedCount++;
            } else {
              dupCount++;
            }
          }

          alert(`Processamento concluído: ${addedCount} novos, ${dupCount} duplicados ignorados.`);
          fetchBankTransactions();
        }
        setLoading(false);
      };
      reader.readAsText(file);
    }
  };

  // 4. Open "Create" Modal
  const openCreateModal = (tx: any) => {
    setSelectedTx(tx);
    setCreateForm({
      category_id: '',
      description: tx.descricao, // Suggest bank description
      entity_name: ''
    });
    setIsCreateModalOpen(true);
  };

  // 5. Handle "Create" Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx || !createForm.category_id) return;

    setLoading(true);
    try {
      const isIncome = selectedTx.tipo === 'CREDIT';
      const table = isIncome ? 'revenues' : 'expenses';
      const amount = Math.abs(selectedTx.valor);

      // A. Create Revenue/Expense
      const payload: any = {
        description: createForm.description,
        data_competencia: selectedTx.data,
        category_id: createForm.category_id,
        bank_account_id: selectedAccountId,
        observacoes: 'Conciliado via OFX'
      };

      if (isIncome) {
        payload.valor_bruto = amount;
        payload.valor_liquido = amount; // Assume net for reconciliation unless edited
        payload.data_recebimento = selectedTx.data;
        payload.forma_pagamento = 'Transferência'; // Default for bank tx
        payload.paciente = createForm.entity_name;
      } else {
        payload.valor = amount;
        payload.data_pagamento = selectedTx.data;
        payload.fornecedor = createForm.entity_name;
        payload.tipo_despesa = 'Variavel';
      }

      const { data: newRecord, error } = await supabase
        .from(table)
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      // B. Update Bank Transaction as Conciliated
      const updatePayload: any = {
        conciliado: true,
      };
      if (isIncome) updatePayload.revenue_id_opcional = newRecord.id;
      else updatePayload.expense_id_opcional = newRecord.id;

      await supabase
        .from('bank_transactions')
        .update(updatePayload)
        .eq('id', selectedTx.id);

      // C. Update Bank Account Balance? 
      // NOTE: If we are importing past transactions, usually we adjust balance manually or 
      // we assume the 'current_balance' in bank_accounts is the TRUE balance. 
      // For now, let's update it to keep consistent with manual entry logic.
      const account = accounts.find(a => a.id === selectedAccountId);
      if (account) {
        const currentBalance = Number((account as any).current_balance || 0);
        const newBal = currentBalance + selectedTx.valor; // OFX amount has sign
        await supabase.from('bank_accounts').update({ current_balance: newBal }).eq('id', selectedAccountId);
      }

      setIsCreateModalOpen(false);
      fetchBankTransactions();

    } catch (error: any) {
      alert('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Conciliação Bancária</h1>
        <p className="text-gray-500">Importe extratos OFX e concilie lançamentos</p>
      </div>

      {/* Account Selection */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Selecione a Conta para Conciliar</label>
        <select
          className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
        >
          <option value="">Selecione...</option>
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {(acc as any).nome_conta || acc.name || 'Conta'} ({(acc as any).banco || acc.bank || 'Banco'})
            </option>
          ))}
        </select>
      </div>

      {selectedAccountId && (
        <>
          {/* Upload Area */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center border-dashed border-2 border-brand-100">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
                {loading ? <Loader2 className="animate-spin" size={32} /> : <Upload size={32} />}
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-800">Importar arquivo OFX</h3>
                <p className="text-gray-500 text-sm mt-1">Os lançamentos serão salvos e verificados contra duplicidade.</p>
              </div>
              <input
                type="file"
                accept=".ofx"
                id="ofx-upload"
                className="hidden"
                onChange={handleFileUpload}
                disabled={loading}
              />
              <label
                htmlFor="ofx-upload"
                className={`px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 cursor-pointer transition-colors ${loading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                Selecionar Arquivo
              </label>
              {fileName && (
                <p className="text-xs text-gray-500">Selecionado: {fileName}</p>
              )}
            </div>
          </div>

          {/* List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-700">Lançamentos Bancários</h3>
              <span className="text-xs text-gray-400">Ordenado por data (mais recente)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white text-gray-500 font-medium border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Data</th>
                    <th className="px-6 py-3">Descrição Banco</th>
                    <th className="px-6 py-3">Valor</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bankTransactions.map((t) => {
                    const isCredit = t.tipo === 'CREDIT';

                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-gray-600">{formatDate(t.data)}</td>
                        <td className="px-6 py-4 font-medium text-gray-800">{t.descricao}</td>
                        <td className={`px-6 py-4 font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(t.valor)}
                        </td>
                        <td className="px-6 py-4">
                          {t.conciliado ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              <CheckCircle size={12} /> Conciliado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                              <AlertCircle size={12} /> Pendente
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!t.conciliado && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                className="flex items-center gap-1 px-3 py-1 text-xs border border-brand-200 text-brand-700 bg-brand-50 rounded hover:bg-brand-100 transition-colors opacity-50 cursor-not-allowed"
                                title="Em breve: Vincular a lançamento já existente"
                              >
                                <LinkIcon size={12} /> Vincular
                              </button>
                              <button
                                onClick={() => openCreateModal(t)}
                                className="flex items-center gap-1 px-3 py-1 text-xs bg-brand-600 text-white rounded hover:bg-brand-700 transition-colors"
                                title="Criar receita/despesa a partir deste item"
                              >
                                <PlusCircle size={12} /> Criar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {bankTransactions.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">Nenhum lançamento importado nesta conta.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Criar Lançamento da Conciliação */}
      {isCreateModalOpen && selectedTx && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1">
              Nova {selectedTx.tipo === 'CREDIT' ? 'Receita' : 'Despesa'} (Conciliação)
            </h2>
            <div className="mb-4 text-sm text-gray-500 flex gap-2">
              <span>{formatDate(selectedTx.data)}</span>
              <span>•</span>
              <span className={selectedTx.tipo === 'CREDIT' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                {formatCurrency(selectedTx.valor)}
              </span>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input
                  required
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  required
                  value={createForm.category_id}
                  onChange={e => setCreateForm({ ...createForm, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white"
                >
                  <option value="">Selecione...</option>
                  {categories
                    .filter(c => (c as any).tipo === (selectedTx.tipo === 'CREDIT' ? 'receita' : 'despesa'))
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {selectedTx.tipo === 'CREDIT' ? 'Paciente / Pagador' : 'Fornecedor'}
                </label>
                <input
                  value={createForm.entity_name}
                  onChange={e => setCreateForm({ ...createForm, entity_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Confirmar e Conciliar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reconciliation;
