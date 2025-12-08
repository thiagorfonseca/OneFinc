import React, { useEffect, useState, useMemo } from 'react';
import { Shield, Users, Building2, Wallet, RefreshCw, Plus, Loader2, CheckSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';

const Admin: React.FC = () => {
  const PAGE_OPTIONS = ['/incomes','/expenses','/reconciliation','/accounts','/settings','/admin'];
  const [tab, setTab] = useState<'overview' | 'clinics' | 'users'>('overview');
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<any[]>([]);
  const [clinicForm, setClinicForm] = useState({
    name: '',
    responsavel_nome: '',
    documento: '',
    email_contato: '',
    telefone_contato: '',
    plano: 'basico',
    paginas_liberadas: [] as string[],
    ativo: true,
  });
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null);
  const [selectedClinics, setSelectedClinics] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todas' | 'ativas' | 'inativas'>('todas');
  const [clinicUsers, setClinicUsers] = useState<any[]>([]);
  const [userForm, setUserForm] = useState({ clinic_id: '', name: '', email: '', role: 'user', ativo: true, paginas_liberadas: [] as string[] });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [bulkUserRole, setBulkUserRole] = useState('user');
  const [bulkUserPages, setBulkUserPages] = useState<string[]>([]);
  const [savingClinic, setSavingClinic] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  const fetchClinics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('*, bank_accounts (id), categories (id), clinic_users (id, ativo)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClinics((data || []) as any[]);
    } catch (err) {
      console.error('Erro ao carregar clínicas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleClinics = async (ids: string[], ativo: boolean) => {
    if (!ids.length) return;
    const { error } = await supabase.from('clinics').update({ ativo }).in('id', ids);
    if (error) {
      alert('Erro ao atualizar clínicas: ' + error.message);
      return;
    }
    setSelectedClinics([]);
    fetchClinics();
  };

  useEffect(() => {
    fetchClinics();
    supabase.from('clinic_users').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setClinicUsers(data as any[]);
    });
  }, []);

  const totals = useMemo(() => {
    const totalClinics = clinics.length;
    const totalUsers = clinics.reduce((acc, c) => acc + (c.clinic_users?.length || 0), 0);
    const totalUsersAtivos = clinics.reduce(
      (acc, c) => acc + (c.clinic_users?.filter((u: any) => u.ativo !== false).length || 0),
      0
    );
    const totalAccounts = clinics.reduce((acc, c) => acc + (c.bank_accounts?.length || 0), 0);
    return { totalClinics, totalUsers, totalUsersAtivos, totalAccounts };
  }, [clinics]);

  const filteredClinics = useMemo(() => {
    return clinics.filter(c => {
      const matchName = c.name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === 'todas' ||
        (statusFilter === 'ativas' && c.ativo !== false) ||
        (statusFilter === 'inativas' && c.ativo === false);
      return matchName && matchStatus;
    });
  }, [clinics, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield size={22} /> Administrador
          </h1>
          <p className="text-gray-500">Visão geral de todos os clientes (multiusuário)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('overview')}
            className={`px-3 py-2 text-sm rounded-lg border ${tab === 'overview' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            Visão geral
          </button>
          <button
            onClick={() => setTab('clinics')}
            className={`px-3 py-2 text-sm rounded-lg border ${tab === 'clinics' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            Clínicas
          </button>
          <button
            onClick={() => setTab('users')}
            className={`px-3 py-2 text-sm rounded-lg border ${tab === 'users' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            Usuários
          </button>
          <button
            onClick={fetchClinics}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                <Building2 size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Clínicas</p>
                <p className="text-xl font-bold text-gray-800">{totals.totalClinics}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Users size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Usuários</p>
                <p className="text-xl font-bold text-gray-800">
                  {totals.totalUsers} <span className="text-xs text-gray-500">({totals.totalUsersAtivos} ativos)</span>
                </p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Contas Bancárias</p>
                <p className="text-xl font-bold text-gray-800">{totals.totalAccounts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">Clínicas</p>
                <p className="text-sm text-gray-500">Dados gerais de todos os clientes</p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar clínica por nome..."
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
                />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="todas">Todas</option>
                  <option value="ativas">Ativas</option>
                  <option value="inativas">Inativas</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Nome</th>
                    <th className="px-6 py-3">Criada em</th>
                    <th className="px-6 py-3">Plano</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Usuários</th>
                    <th className="px-6 py-3">Contas</th>
                    <th className="px-6 py-3">Categorias</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && (
                    <tr><td colSpan={7} className="px-6 py-6 text-center text-gray-400">Carregando...</td></tr>
                  )}
                  {!loading && filteredClinics.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-6 text-center text-gray-400">Nenhuma clínica encontrada.</td></tr>
                  )}
                  {!loading && filteredClinics.map(clinic => (
                    <tr key={clinic.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-semibold text-gray-800">{clinic.name}</td>
                      <td className="px-6 py-4 text-gray-600">{formatDate(clinic.created_at)}</td>
                      <td className="px-6 py-4 text-gray-600 capitalize">{clinic.plano || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${clinic.ativo === false ? 'bg-gray-100 text-gray-600' : 'bg-emerald-50 text-emerald-700'}`}>
                          {clinic.ativo === false ? 'Inativa' : 'Ativa'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {clinic.clinic_users?.length || 0}
                        {clinic.clinic_users && clinic.clinic_users.length > 0 && (
                          <span className="text-xs text-gray-500"> • {clinic.clinic_users.filter((u: any) => u.ativo !== false).length} ativos</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{clinic.bank_accounts?.length || 0}</td>
                      <td className="px-6 py-4 text-gray-600">{clinic.categories?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'clinics' && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><Building2 size={18}/> Clínicas</h2>
              <p className="text-sm text-gray-500">Gestão completa das clínicas</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleToggleClinics(selectedClinics, true)}
                className="px-3 py-2 text-sm bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100"
              >
                Ativar selecionadas
              </button>
              <button
                onClick={() => handleToggleClinics(selectedClinics, false)}
                className="px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg border border-red-100"
              >
                Desativar selecionadas
              </button>
            </div>
          </div>

          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              if (!clinicForm.name.trim()) return;
              setSavingClinic(true);
              try {
                if (editingClinicId) {
                  const { error } = await supabase.from('clinics').update(clinicForm).eq('id', editingClinicId);
                  if (error) throw error;
                } else {
                  const { error } = await supabase.from('clinics').insert([{ ...clinicForm }]);
                  if (error) throw error;
                }
                setClinicForm({
                  name: '',
                  responsavel_nome: '',
                  documento: '',
                  email_contato: '',
                  telefone_contato: '',
                  plano: 'basico',
                  paginas_liberadas: [],
                  ativo: true,
                });
                setEditingClinicId(null);
                fetchClinics();
              } catch (err: any) {
                alert('Erro ao salvar clínica: ' + err.message);
              } finally {
                setSavingClinic(false);
              }
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Clínica</label>
              <input
                value={clinicForm.name}
                onChange={e => setClinicForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
              <input
                value={clinicForm.responsavel_nome}
                onChange={e => setClinicForm(prev => ({ ...prev, responsavel_nome: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ/CPF</label>
              <input
                value={clinicForm.documento}
                onChange={e => setClinicForm(prev => ({ ...prev, documento: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                value={clinicForm.email_contato}
                onChange={e => setClinicForm(prev => ({ ...prev, email_contato: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                value={clinicForm.telefone_contato}
                onChange={e => setClinicForm(prev => ({ ...prev, telefone_contato: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
              <select
                value={clinicForm.plano}
                onChange={e => setClinicForm(prev => ({ ...prev, plano: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
              >
                <option value="basico">Básico</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Páginas liberadas</label>
              <div className="flex gap-2 mb-2">
                <button type="button" onClick={() => setClinicForm(prev => ({ ...prev, paginas_liberadas: PAGE_OPTIONS }))} className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded border border-emerald-100">Selecionar tudo</button>
                <button type="button" onClick={() => setClinicForm(prev => ({ ...prev, paginas_liberadas: [] }))} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-100">Limpar</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PAGE_OPTIONS.map(page => {
                  const checked = clinicForm.paginas_liberadas.includes(page);
                  return (
                    <label key={page} className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-lg px-2 py-1">
                      <input type="checkbox" checked={checked} onChange={e => {
                        if (e.target.checked) setClinicForm(prev => ({ ...prev, paginas_liberadas: [...prev.paginas_liberadas, page] }));
                        else setClinicForm(prev => ({ ...prev, paginas_liberadas: prev.paginas_liberadas.filter(p => p !== page) }));
                      }} />
                      {page}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={clinicForm.ativo} onChange={e => setClinicForm(prev => ({ ...prev, ativo: e.target.checked }))} className="h-4 w-4 text-brand-600 border-gray-300 rounded" />
                Ativa
              </label>
              <button type="submit" disabled={savingClinic} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 justify-center">
                {savingClinic ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {editingClinicId ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </form>

          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar clínica por nome..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />

          <div className="border border-gray-100 rounded-lg divide-y">
            {filteredClinics.map(clinic => {
              const selected = selectedClinics.includes(clinic.id);
              return (
                <div key={clinic.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selected} onChange={e => {
                      if (e.target.checked) setSelectedClinics(prev => [...prev, clinic.id]);
                      else setSelectedClinics(prev => prev.filter(id => id !== clinic.id));
                    }} />
                    <div>
                      <p className="font-semibold text-gray-800">{clinic.name} {!clinic.ativo && <span className="text-xs text-red-600">(inativa)</span>}</p>
                      <p className="text-xs text-gray-500">ID: {clinic.id} • Plano: {clinic.plano || '—'}</p>
                      <p className="text-xs text-gray-500">Contato: {clinic.responsavel_nome || '-'} • {clinic.email_contato || '-'} • {clinic.telefone_contato || '-'}</p>
                      {clinic.paginas_liberadas && clinic.paginas_liberadas.length > 0 && (
                        <p className="text-xs text-gray-500">Páginas: {clinic.paginas_liberadas.join(', ')}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingClinicId(clinic.id);
                        setClinicForm({
                          name: clinic.name || '',
                          responsavel_nome: clinic.responsavel_nome || '',
                          documento: clinic.documento || '',
                          email_contato: clinic.email_contato || '',
                          telefone_contato: clinic.telefone_contato || '',
                          plano: clinic.plano || 'basico',
                          paginas_liberadas: clinic.paginas_liberadas || [],
                          ativo: clinic.ativo ?? true,
                        });
                      }}
                      className="text-sm text-brand-600"
                    >
                      Editar
                    </button>
                    <span className={`px-2 py-1 text-xs rounded-full ${clinic.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {clinic.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                </div>
              );
            })}
            {filteredClinics.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center">Nenhuma clínica cadastrada.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2"><CheckSquare size={16}/> Usuários da Clínica</h3>
            <div className="flex gap-2">
              <button onClick={() => supabase.from('clinic_users').update({ ativo: true }).in('id', selectedUsers).then(() => supabase.from('clinic_users').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setClinicUsers(data as any[])))} className="px-3 py-2 text-sm bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">Ativar</button>
              <button onClick={() => supabase.from('clinic_users').update({ ativo: false }).in('id', selectedUsers).then(() => supabase.from('clinic_users').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setClinicUsers(data as any[])))} className="px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg border border-red-100">Desativar</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clínica</label>
              <select
                value={userForm.clinic_id}
                onChange={e => setUserForm({ ...userForm, clinic_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
              >
                <option value="">Selecione...</option>
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                value={userForm.name}
                onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="Nome do usuário"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                value={userForm.email}
                onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                placeholder="email@dominio.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Papel/Acesso</label>
              <select
                value={userForm.role}
                onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
              >
                <option value="admin">Admin</option>
                <option value="gestor">Gestor</option>
                <option value="financeiro">Financeiro</option>
                <option value="user">Usuário</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Páginas liberadas</label>
              <div className="flex gap-2 mb-2">
                <button type="button" onClick={() => setUserForm(prev => ({ ...prev, paginas_liberadas: PAGE_OPTIONS }))} className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded border border-emerald-100">Selecionar tudo</button>
                <button type="button" onClick={() => setUserForm(prev => ({ ...prev, paginas_liberadas: [] }))} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-100">Limpar</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PAGE_OPTIONS.map((page) => {
                  const checked = userForm.paginas_liberadas.includes(page);
                  return (
                    <label key={page} className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-lg px-2 py-1">
                      <input type="checkbox" checked={checked} onChange={(e) => {
                        if (e.target.checked) setUserForm(prev => ({ ...prev, paginas_liberadas: [...prev.paginas_liberadas, page] }));
                        else setUserForm(prev => ({ ...prev, paginas_liberadas: prev.paginas_liberadas.filter(p => p !== page) }));
                      }} />
                      {page}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={userForm.ativo} onChange={e => setUserForm(prev => ({ ...prev, ativo: e.target.checked }))} className="h-4 w-4 text-brand-600 border-gray-300 rounded" />
                Ativo
              </label>
              <button
                type="button"
                onClick={async () => {
                  setSavingUser(true);
                  try {
                    if (editingUserId) {
                      const { error } = await supabase.from('clinic_users').update(userForm).eq('id', editingUserId);
                      if (error) throw error;
                    } else {
                      const { error } = await supabase.from('clinic_users').insert([userForm]);
                      if (error) throw error;
                    }
                    const { data } = await supabase.from('clinic_users').select('*').order('created_at', { ascending: false });
                    if (data) setClinicUsers(data as any[]);
                    setUserForm({ clinic_id: '', name: '', email: '', role: 'user', ativo: true, paginas_liberadas: [] });
                    setEditingUserId(null);
                  } catch (err: any) {
                    alert('Erro ao salvar usuário: ' + err.message);
                  } finally {
                    setSavingUser(false);
                  }
                }}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 justify-center"
              >
                {savingUser ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {editingUserId ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="Buscar usuário por nome..."
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 flex-1"
            />
            <button
              onClick={() => {
                supabase.from('clinic_users').update({
                  role: bulkUserRole,
                  paginas_liberadas: bulkUserPages,
                }).in('id', selectedUsers).then(() => supabase.from('clinic_users').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setClinicUsers(data as any[])));
              }}
              className="px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
            >
              Aplicar papel/páginas
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aplicar papel aos selecionados</label>
              <select
                value={bulkUserRole}
                onChange={e => setBulkUserRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
              >
                <option value="admin">Admin</option>
                <option value="gestor">Gestor</option>
                <option value="financeiro">Financeiro</option>
                <option value="user">Usuário</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Páginas liberadas (aplicar aos selecionados)</label>
              <div className="flex gap-2 mb-2">
                <button type="button" onClick={() => setBulkUserPages(PAGE_OPTIONS)} className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded border border-emerald-100">Selecionar tudo</button>
                <button type="button" onClick={() => setBulkUserPages([])} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-100">Limpar</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PAGE_OPTIONS.map((page) => {
                  const checked = bulkUserPages.includes(page);
                  return (
                    <label key={page} className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-lg px-2 py-1">
                      <input type="checkbox" checked={checked} onChange={(e) => {
                        if (e.target.checked) setBulkUserPages(prev => [...prev, page]);
                        else setBulkUserPages(prev => prev.filter(p => p !== page));
                      }} />
                      {page}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border border-gray-100 rounded-lg divide-y">
            {clinicUsers
              .filter((u: any) => u.name?.toLowerCase().includes(userSearch.toLowerCase()))
              .map(u => {
                const selected = selectedUsers.includes(u.id);
                return (
                  <div key={u.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedUsers(prev => [...prev, u.id]);
                          else setSelectedUsers(prev => prev.filter(id => id !== u.id));
                        }}
                      />
                      <div>
                        <p className="font-semibold text-gray-800">{u.name} <span className="text-xs text-gray-500">({u.role || 'user'})</span></p>
                        <p className="text-xs text-gray-500">{u.email} • Clínica: {u.clinic_id}</p>
                        {u.paginas_liberadas && u.paginas_liberadas.length > 0 && (
                          <p className="text-xs text-gray-500">Páginas: {u.paginas_liberadas.join(', ')}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingUserId(u.id);
                          setUserForm({
                            clinic_id: u.clinic_id,
                            name: u.name || '',
                            email: u.email || '',
                            role: u.role || 'user',
                            ativo: u.ativo ?? true,
                            paginas_liberadas: u.paginas_liberadas || [],
                          });
                        }}
                        className="text-sm text-brand-600"
                      >
                        Editar
                      </button>
                      <span className={`px-2 py-1 text-xs rounded-full ${u.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                );
              })}
            {clinicUsers.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center">Nenhum usuário cadastrado.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
