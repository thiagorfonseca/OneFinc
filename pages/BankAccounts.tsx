import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Wallet, Loader2, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BankAccount } from '../types';
import { formatCurrency } from '../lib/utils';

const BankAccounts: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    bank: '',
    initial_balance: '0,00'
  });

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*');
      if (error) throw error;
      setAccounts(data as any || []);
    } catch (error) {
      console.error('Erro ao buscar contas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const balance = parseFloat(formData.initial_balance.replace(',', '.'));
      if (editingId) {
        const { error } = await supabase
          .from('bank_accounts')
          .update({
            nome_conta: formData.name,
            banco: formData.bank,
          })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('bank_accounts').insert([{
          nome_conta: formData.name, // Mapeando para o schema correto
          banco: formData.bank,
          initial_balance: balance,
          current_balance: balance, // Inicialmente igual
          ativo: true
        }]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', bank: '', initial_balance: '0,00' });
      fetchAccounts();
    } catch (error: any) {
      alert('Erro ao salvar conta: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (acc: any) => {
    setEditingId(acc.id);
    setFormData({
      name: acc.nome_conta || acc.name || '',
      bank: acc.banco || acc.bank || '',
      initial_balance: String((acc.initial_balance ?? acc.current_balance ?? 0)).replace('.', ','),
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza? Isso pode afetar transações vinculadas.')) return;
    try {
      const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
      if (error) throw error;
      fetchAccounts();
    } catch (error: any) {
      alert('Erro ao excluir: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Contas Bancárias</h1>
          <p className="text-gray-500">Gerencie onde o dinheiro entra e sai</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus size={20} /> Nova Conta
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-600" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-48 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(acc)} className="text-gray-400 hover:text-brand-600">
                    <Edit size={18} />
                  </button>
                  <button onClick={() => handleDelete(acc.id)} className="text-gray-400 hover:text-red-600">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{acc.name || (acc as any).nome_conta}</h3>
                  <p className="text-sm text-gray-500">{acc.bank || (acc as any).banco}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Saldo Atual</p>
                <p className="text-2xl font-bold text-gray-800">
                  {formatCurrency((acc as any).current_balance || 0)}
                </p>
              </div>
            </div>
          ))}
          
          {accounts.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-500">Nenhuma conta cadastrada.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">{editingId ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Conta (Apelido)</label>
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Ex: Itaú Principal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                <input
                  required
                  value={formData.bank}
                  onChange={e => setFormData({...formData, bank: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Ex: Itaú, Nubank, Caixa"
                />
              </div>
              <div>
                {!editingId && (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Inicial (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.initial_balance}
                      onChange={e => setFormData({...formData, initial_balance: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankAccounts;
