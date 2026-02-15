import React, { useEffect, useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import { useAuth } from '../src/auth/AuthProvider';
 
const STANDARD_DEPARTMENTS = [
  'Assistencial / Clínico',
  'Diagnóstico e Terapias',
  'Atendimento e Experiência do Paciente',
  'Operações',
  'Financeiro e Controladoria',
  'Comercial / Marketing',
  'Administração / Backoffice',
  'Pessoas (RH / DP)',
  'Qualidade, Compliance e Regulatórios',
  'Tecnologia e Dados (TI)',
  'Suprimentos e Logística',
  'Facilities e Serviços Gerais',
  'Jurídico e Societário',
  'Governança e Direção',
  'Ensino e Pesquisa',
];

const HRDepartments: React.FC = () => {
  const { effectiveClinicId: clinicId } = useAuth();
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'boxes' | 'list'>('boxes');

  const loadDepartments = async () => {
    if (!clinicId) {
      setDepartments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('hr_departments')
      .select('id, name, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setDepartments(data as any[]);
      const existingNames = new Set((data as any[]).map((item) => item.name));
      const selected = STANDARD_DEPARTMENTS.filter((name) => existingNames.has(name));
      setSelectedDepartments(selected);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDepartments();
  }, [clinicId]);

  const filteredDepartments = useMemo(() => {
    if (!search.trim()) return STANDARD_DEPARTMENTS;
    const needle = search.toLowerCase();
    return STANDARD_DEPARTMENTS.filter((dep) => dep.toLowerCase().includes(needle));
  }, [search]);

  const handleSave = async () => {
    if (!clinicId) {
      setFormError('Nenhuma clínica ativa para salvar departamentos.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const selectedSet = new Set(selectedDepartments);
      const existingByName = new Map(departments.map((dep) => [dep.name, dep]));
      const toInsert = STANDARD_DEPARTMENTS.filter((name) => selectedSet.has(name) && !existingByName.has(name));
      const toDelete = departments.filter((dep) => !selectedSet.has(dep.name));

      if (toDelete.length) {
        await supabase.from('hr_departments').delete().in('id', toDelete.map((dep) => dep.id));
      }
      if (toInsert.length) {
        await supabase.from('hr_departments').insert(
          toInsert.map((name) => ({ clinic_id: clinicId, name }))
        );
      }
      loadDepartments();
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao salvar departamentos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-brand-600 font-semibold">Recursos Humanos</p>
          <h1 className="text-2xl font-bold text-gray-900">Departamentos</h1>
          <p className="text-sm text-gray-500">Selecione os departamentos padrão que serão usados na clínica.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDepartments(STANDARD_DEPARTMENTS)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
          >
            Selecionar todos
          </button>
          <button
            type="button"
            onClick={() => setSelectedDepartments([])}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar seleção'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por departamento"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-brand-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users size={16} />
          {selectedDepartments.length} selecionados de {STANDARD_DEPARTMENTS.length}
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('boxes')}
            className={`px-3 py-2 text-xs font-medium ${viewMode === 'boxes' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            aria-pressed={viewMode === 'boxes'}
          >
            Boxes
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 text-xs font-medium ${viewMode === 'list' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            aria-pressed={viewMode === 'list'}
          >
            Lista
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Departamentos padrão</p>
          <span className="text-xs text-gray-400">Escolha quais serão utilizados</span>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">Carregando departamentos...</div>
        ) : (
          <>
            {viewMode === 'boxes' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {filteredDepartments.map((depName) => {
                  const checked = selectedDepartments.includes(depName);
                  const existing = departments.find((dep) => dep.name === depName);
                  return (
                    <label
                      key={depName}
                      className={`border rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition ${
                        checked ? 'border-brand-300 bg-brand-50' : 'border-gray-100 bg-white hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{depName}</p>
                          {existing?.created_at ? (
                            <p className="text-xs text-gray-500">Ativo desde {formatDate(existing.created_at || '')}</p>
                          ) : (
                            <p className="text-xs text-gray-400">Ainda não utilizado pela clínica.</p>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedDepartments((prev) => [...prev, depName]);
                            else setSelectedDepartments((prev) => prev.filter((name) => name !== depName));
                          }}
                        />
                      </div>
                    </label>
                  );
                })}
                {filteredDepartments.length === 0 && (
                  <div className="col-span-full px-6 py-12 text-center text-sm text-gray-400">
                    Nenhum departamento encontrado.
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredDepartments.map((depName, idx) => {
                  const checked = selectedDepartments.includes(depName);
                  const existing = departments.find((dep) => dep.name === depName);
                  return (
                    <label key={depName} className="px-4 sm:px-6 py-4 flex flex-wrap items-center gap-4 hover:bg-gray-50 cursor-pointer">
                      <div className="w-10 text-sm text-gray-400">#{String(idx + 1).padStart(2, '0')}</div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedDepartments((prev) => [...prev, depName]);
                          else setSelectedDepartments((prev) => prev.filter((name) => name !== depName));
                        }}
                      />
                      <div className="flex-1 min-w-[220px]">
                        <p className="text-sm font-semibold text-gray-900">{depName}</p>
                        {existing?.created_at ? (
                          <p className="text-xs text-gray-500">Ativo desde {formatDate(existing.created_at || '')}</p>
                        ) : (
                          <p className="text-xs text-gray-400">Ainda não utilizado pela clínica.</p>
                        )}
                      </div>
                    </label>
                  );
                })}
                {filteredDepartments.length === 0 && (
                  <div className="px-6 py-12 text-center text-sm text-gray-400">Nenhum departamento encontrado.</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-lg">{formError}</div>
      )}
    </div>
  );
};

export default HRDepartments;
