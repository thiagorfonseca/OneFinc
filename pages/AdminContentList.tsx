import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface ContentItem {
  id: string;
  type: 'course' | 'training';
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  published: boolean | null;
  created_at: string | null;
}

const AdminContentList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const typeParam = searchParams.get('type');
  const type: 'course' | 'training' = typeParam === 'training' ? 'training' : 'course';
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    thumbnail_url: '',
  });

  const label = useMemo(() => (type === 'course' ? 'Cursos' : 'Treinamentos'), [type]);

  const loadItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('content_items')
      .select('id, type, title, description, thumbnail_url, published, created_at')
      .eq('type', type)
      .order('created_at', { ascending: false });
    setItems((data || []) as ContentItem[]);
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, [type]);

  const handleCreate = async () => {
    if (!newItem.title.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('content_items')
      .insert({
        type,
        title: newItem.title.trim(),
        description: newItem.description || null,
        thumbnail_url: newItem.thumbnail_url || null,
        published: false,
      })
      .select('id')
      .single();
    setSaving(false);
    if (!error && data?.id) {
      setNewItem({ title: '', description: '', thumbnail_url: '' });
      navigate(`/admin/content/${data.id}?tab=about&type=${type}`);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Conteúdos</h1>
        <p className="text-gray-500">Gerencie cursos e treinamentos publicados.</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSearchParams({ type: 'course' })}
          className={`px-3 py-2 text-sm rounded-lg border ${
            type === 'course' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'
          }`}
        >
          Cursos
        </button>
        <button
          type="button"
          onClick={() => setSearchParams({ type: 'training' })}
          className={`px-3 py-2 text-sm rounded-lg border ${
            type === 'training' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'
          }`}
        >
          Treinamentos
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Novo {label.slice(0, -1)}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={newItem.title}
            onChange={(e) => setNewItem((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Título"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <input
            value={newItem.thumbnail_url}
            onChange={(e) => setNewItem((prev) => ({ ...prev, thumbnail_url: e.target.value }))}
            placeholder="Thumbnail URL"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            Criar
          </button>
        </div>
        <textarea
          value={newItem.description}
          onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Descrição"
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center text-gray-500">Carregando conteúdos...</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-6 text-gray-500 text-sm">
          Nenhum conteúdo cadastrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/admin/content/${item.id}?tab=about&type=${type}`}
              className="group bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition"
            >
              {item.thumbnail_url ? (
                <img src={item.thumbnail_url} alt={item.title || 'Conteúdo'} className="h-40 w-full object-cover" />
              ) : (
                <div className="h-40 w-full bg-gradient-to-br from-slate-100 to-slate-200" />
              )}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800 group-hover:text-brand-600">
                    {item.title || 'Sem título'}
                  </h3>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      item.published ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {item.published ? 'Publicado' : 'Rascunho'}
                  </span>
                </div>
                {item.description && <p className="text-sm text-gray-600 line-clamp-3">{item.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminContentList;
