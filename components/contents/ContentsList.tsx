import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../src/auth/AuthProvider';

interface ContentItem {
  id: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  created_at?: string | null;
}

interface Props {
  type: 'course' | 'training';
  title: string;
  subtitle: string;
  basePath: string;
}

const ContentsList: React.FC<Props> = ({ type, title, subtitle, basePath }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const { clinicId, clinicPackageIds } = useAuth();

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (clinicId && clinicPackageIds.length) {
        const { data, error: packageError } = await (supabase as any)
          .from('content_package_items')
          .select('content_items (id, title, description, thumbnail_url, type, published, created_at)')
          .in('package_id', clinicPackageIds);
        if (!isMounted.current) return;
        if (packageError) throw packageError;
        const map = new Map<string, ContentItem>();
        (data || []).forEach((row: any) => {
          const item = row.content_items;
          if (!item || item.published !== true || item.type !== type) return;
          if (!map.has(item.id)) {
            map.set(item.id, {
              id: item.id,
              title: item.title,
              description: item.description,
              thumbnail_url: item.thumbnail_url,
              created_at: item.created_at,
            });
          }
        });
        const list = Array.from(map.values()).sort((a, b) =>
          (b.created_at || '').localeCompare(a.created_at || '')
        );
        setItems(list);
        setLoading(false);
        return;
      }

      const { data, error: loadError } = await supabase
        .from('content_items')
        .select('id, title, description, thumbnail_url, created_at')
        .eq('type', type)
        .eq('published', true)
        .order('created_at', { ascending: false });
      if (!isMounted.current) return;
      if (loadError) throw loadError;
      setItems((data || []) as ContentItem[]);
      setLoading(false);
    } catch (err: any) {
      if (!isMounted.current) return;
      setError(err.message || 'Erro ao carregar conteúdos.');
      setItems([]);
      setLoading(false);
    }
  }, [type, clinicId, clinicPackageIds]);

  useEffect(() => {
    isMounted.current = true;
    loadItems();
    return () => {
      isMounted.current = false;
    };
  }, [loadItems]);

  if (loading) {
    return <div className="h-48 flex items-center justify-center text-gray-500">Carregando conteúdos...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        <p className="text-gray-500">{subtitle}</p>
      </div>

      {error && (
        <div className="bg-white border border-gray-100 rounded-xl p-6 text-sm text-red-600 space-y-3">
          <p>Erro ao carregar conteúdos: {error}</p>
          <button
            type="button"
            onClick={loadItems}
            className="px-3 py-2 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-6 text-gray-500 text-sm">
          {clinicId && clinicPackageIds.length
            ? 'Nenhum conteúdo liberado para este pacote.'
            : 'Nenhum conteúdo publicado.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`${basePath}/${item.id}`}
              className="group bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition"
            >
              {item.thumbnail_url ? (
                <img
                  src={item.thumbnail_url}
                  alt={item.title || 'Conteúdo'}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="h-40 w-full bg-gradient-to-br from-slate-100 to-slate-200" />
              )}
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-gray-800 group-hover:text-brand-600">
                  {item.title || 'Sem título'}
                </h3>
                {item.description && (
                  <p className="text-sm text-gray-600 line-clamp-3">{item.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContentsList;
