import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import { useAuth } from '../../../auth/AuthProvider';
import { createPublicLink, listPublicLinks, togglePublicLink } from '../archetypeService';
import type { AudienceType, PublicLinkRow } from '../types';

const generateToken = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 12);
};

const PublicLinksManagementPage: React.FC = () => {
  const { effectiveClinicId: clinicId, user } = useAuth();
  const [links, setLinks] = useState<PublicLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [token, setToken] = useState(generateToken());
  const [audienceType, setAudienceType] = useState<AudienceType>('EXTERNAL');
  const [error, setError] = useState<string | null>(null);

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin.replace(/\/$/, '');
  }, []);

  const loadLinks = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listPublicLinks(clinicId);
      setLinks(data);
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar os links.');
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const handleCreate = async () => {
    if (!clinicId) return;
    if (!token.trim()) {
      setError('Informe um token válido.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await createPublicLink({
        clinic_id: clinicId,
        token: token.trim(),
        audience_type: audienceType,
        created_by_user_id: user?.id || null,
      });
      setLinks((prev) => [created, ...prev]);
      setToken(generateToken());
    } catch (err) {
      console.error(err);
      setError('Não foi possível criar o link. Verifique se o token já existe.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (tokenValue: string) => {
    const url = `${baseUrl}/public/perfil/${tokenValue}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  };

  const handleToggle = async (link: PublicLinkRow) => {
    try {
      const updated = await togglePublicLink(link.id, !link.is_active);
      setLinks((prev) => prev.map((item) => (item.id === link.id ? updated : item)));
    } catch (err) {
      console.error(err);
      setError('Não foi possível atualizar o link.');
    }
  };

  if (!clinicId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-800">Links de Perfil</h1>
        <p className="text-sm text-gray-500">Selecione uma clínica para gerenciar os links.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Links de Perfil</h1>
        <p className="text-gray-500">Crie e gerencie links públicos do teste comportamental.</p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="bg-white border border-gray-100 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500">Token público</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Audiência</label>
          <select
            value={audienceType}
            onChange={(e) => setAudienceType(e.target.value as AudienceType)}
            className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
          >
            <option value="INTERNAL">Interna</option>
            <option value="EXTERNAL">Externa</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white font-medium disabled:opacity-50"
          >
            <Plus size={16} />
            {creating ? 'Criando...' : 'Criar link'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Token</th>
                <th className="text-left px-4 py-3">Audiência</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Link</th>
                <th className="text-left px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {links.map((link) => (
                <tr key={link.id}>
                  <td className="px-4 py-3 font-medium text-gray-800">{link.token}</td>
                  <td className="px-4 py-3">{link.audience_type === 'INTERNAL' ? 'Interna' : 'Externa'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${link.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {link.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {baseUrl ? `${baseUrl}/public/perfil/${link.token}` : 'Link indisponível'}
                  </td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(link.token)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600"
                    >
                      <Copy size={14} />
                      Copiar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(link)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600"
                    >
                      {link.is_active ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && links.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={5}>
                    Nenhum link criado.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={5}>
                    Carregando links...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PublicLinksManagementPage;
