import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Info, Play, Plus, X } from 'lucide-react';
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

interface ContentModule {
  id: string;
  title: string | null;
  order_index: number | null;
  thumbnail_url: string | null;
}

interface ContentLesson {
  id: string;
  module_id: string | null;
  title: string | null;
  description: string | null;
  order_index: number | null;
}

const NEW_BADGE_DAYS = 30;
const WATCHLIST_STORAGE_KEY = 'content-watchlist';

const ContentsList: React.FC<Props> = ({ type, title, subtitle, basePath }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const { clinicId, clinicPackageIds } = useAuth();
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState<ContentItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalModules, setModalModules] = useState<ContentModule[]>([]);
  const [modalLessons, setModalLessons] = useState<Record<string, ContentLesson[]>>({});
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [progressIds, setProgressIds] = useState<Set<string>>(new Set());

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

  const loadModulesForItem = useCallback(async (contentId: string) => {
    setModalLoading(true);
    setModalError(null);
    try {
      const { data: modulesData, error: modulesError } = await supabase
        .from('content_modules')
        .select('id, title, order_index, thumbnail_url')
        .eq('content_id', contentId)
        .order('order_index', { ascending: true });
      if (modulesError) throw modulesError;
      const modulesList = (modulesData || []) as ContentModule[];
      setModalModules(modulesList);
      if (!modulesList.length) {
        setModalLessons({});
        setModalLoading(false);
        return;
      }
      const moduleIds = modulesList.map((module) => module.id);
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('content_lessons')
        .select('id, module_id, title, description, order_index')
        .in('module_id', moduleIds)
        .order('order_index', { ascending: true });
      if (lessonsError) throw lessonsError;
      const map: Record<string, ContentLesson[]> = {};
      (lessonsData || []).forEach((lesson) => {
        if (!lesson.module_id) return;
        if (!map[lesson.module_id]) map[lesson.module_id] = [];
        map[lesson.module_id].push(lesson as ContentLesson);
      });
      setModalLessons(map);
    } catch (err: any) {
      setModalError(err.message || 'Erro ao carregar episódios.');
      setModalModules([]);
      setModalLessons({});
    } finally {
      setModalLoading(false);
    }
  }, []);

  const loadWatchlist = useCallback(() => {
    if (typeof window === 'undefined') return new Set<string>();
    try {
      const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return new Set<string>();
      return new Set(parsed.filter((id) => typeof id === 'string'));
    } catch {
      return new Set<string>();
    }
  }, []);

  const toggleWatchlist = (contentId: string) => {
    setWatchlistIds((prev) => {
      const next = new Set(prev);
      if (next.has(contentId)) next.delete(contentId);
      else next.add(contentId);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(Array.from(next)));
        } catch {
          // ignore storage errors
        }
      }
      return next;
    });
  };

  const loadProgressIds = useCallback(() => {
    if (typeof window === 'undefined') return;
    const next = new Set<string>();
    items.forEach((item) => {
      try {
        if (window.localStorage.getItem(`content-progress:${item.id}`)) {
          next.add(item.id);
        }
      } catch {
        // ignore storage errors
      }
    });
    setProgressIds(next);
  }, [items]);

  useEffect(() => {
    setWatchlistIds(loadWatchlist());
  }, [loadWatchlist]);

  useEffect(() => {
    loadProgressIds();
  }, [loadProgressIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key.startsWith('content-progress:')) {
        loadProgressIds();
      }
      if (event.key === WATCHLIST_STORAGE_KEY) {
        setWatchlistIds(loadWatchlist());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [loadProgressIds, loadWatchlist]);

  const handleOpenModal = (item: ContentItem) => {
    setActiveItem(item);
    setModalOpen(true);
    setModalModules([]);
    setModalLessons({});
    setModalError(null);
    loadModulesForItem(item.id);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setActiveItem(null);
    setModalModules([]);
    setModalLessons({});
    setModalError(null);
  };

  const handleLessonClick = (lessonId: string) => {
    if (!activeItem) return;
    handleCloseModal();
    navigate(`${basePath}/${activeItem.id}?lesson=${lessonId}`);
  };

  const handlePlayContent = (contentId: string) => {
    navigate(`${basePath}/${contentId}`);
  };

  const firstLessonId = useMemo(() => {
    for (const module of modalModules) {
      const lessons = modalLessons[module.id];
      if (lessons && lessons.length) return lessons[0].id;
    }
    return null;
  }, [modalModules, modalLessons]);

  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCloseModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen]);

  if (loading) {
    return <div className="h-48 flex items-center justify-center text-gray-500">Carregando conteúdos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900">{title}</h1>
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
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Colecao</p>
            <span className="text-xs text-gray-400">Arraste para ver mais</span>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-6 scroll-smooth snap-x snap-mandatory">
            {items.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleOpenModal(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleOpenModal(item);
                  }
                }}
                className="group relative flex-shrink-0 w-[280px] sm:w-[360px] lg:w-[420px] xl:w-[480px] snap-start focus:outline-none cursor-pointer"
              >
                <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
                  {progressIds.has(item.id) && (
                    <span className="rounded-full bg-brand-600/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white shadow-sm">
                      Em andamento
                    </span>
                  )}
                  {item.created_at && new Date(item.created_at).getTime() >= Date.now() - NEW_BADGE_DAYS * 86400000 && (
                    <span className="rounded-full bg-rose-600/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white shadow-sm">
                      Novo
                    </span>
                  )}
                  {watchlistIds.has(item.id) && (
                    <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-900 shadow-sm">
                      Na lista
                    </span>
                  )}
                </div>
                <div className="relative rounded-2xl overflow-hidden bg-slate-100 shadow-sm ring-1 ring-slate-200/60 transition duration-300 ease-out transform-gpu group-hover:scale-[1.03] group-hover:-translate-y-1 group-hover:shadow-xl group-focus-visible:scale-[1.03] group-focus-visible:-translate-y-1">
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt={item.title || 'Conteúdo'}
                      className="h-64 sm:h-72 lg:h-80 w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-64 sm:h-72 lg:h-80 w-full bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />
                  <div className="absolute inset-x-0 bottom-0 p-5 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <h3 className="text-lg font-semibold text-white">
                      {item.title || 'Sem título'}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-slate-200 mt-2 line-clamp-3">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handlePlayContent(item.id);
                        }}
                        className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-white"
                      >
                        <Play size={14} /> Assistir
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleWatchlist(item.id);
                        }}
                        className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
                        aria-pressed={watchlistIds.has(item.id)}
                      >
                        {watchlistIds.has(item.id) ? <Check size={14} /> : <Plus size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenModal(item);
                        }}
                        className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
                      >
                        <Info size={14} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 px-1">
                  <h4 className="text-base font-semibold text-gray-800 line-clamp-2">
                    {item.title || 'Sem título'}
                  </h4>
                  {item.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalOpen && activeItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm px-4 py-6"
          onClick={handleCloseModal}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-3xl bg-slate-950 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative h-56 sm:h-72">
              {activeItem.thumbnail_url ? (
                <img
                  src={activeItem.thumbnail_url}
                  alt={activeItem.title || 'Conteúdo'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              <button
                type="button"
                onClick={handleCloseModal}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
              <div className="absolute bottom-0 left-0 right-0 px-6 pb-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold">{activeItem.title || 'Conteúdo'}</h2>
                    {activeItem.description && (
                      <p className="text-sm text-slate-200 max-w-2xl line-clamp-3">
                        {activeItem.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!firstLessonId}
                      onClick={() => firstLessonId && handleLessonClick(firstLessonId)}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
                    >
                      <Play size={16} /> Assistir
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 pt-5 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Episódios</h3>
                <span className="text-xs text-slate-400">
                  {modalModules.length} módulos
                </span>
              </div>

              {modalLoading && (
                <div className="py-10 text-center text-sm text-slate-400">
                  Carregando episódios...
                </div>
              )}

              {!modalLoading && modalError && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  {modalError}
                </div>
              )}

              {!modalLoading && !modalError && modalModules.length === 0 && (
                <div className="py-10 text-center text-sm text-slate-400">
                  Nenhum episódio cadastrado.
                </div>
              )}

              {!modalLoading && !modalError && modalModules.length > 0 && (
                <div className="mt-5 space-y-6">
                  {modalModules.map((module, moduleIndex) => {
                    const lessons = modalLessons[module.id] || [];
                    return (
                      <div key={module.id} className="space-y-3">
                        <div className="flex items-center justify-between text-sm text-slate-300">
                          <h4 className="text-base font-semibold text-white">
                            {module.title || `Módulo ${moduleIndex + 1}`}
                          </h4>
                          <span className="text-xs text-slate-500">
                            {lessons.length} aula{lessons.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        {lessons.length === 0 ? (
                          <div className="text-xs text-slate-400">Nenhuma aula neste módulo.</div>
                        ) : (
                          <div className="space-y-3">
                            {lessons.map((lesson, lessonIndex) => (
                              <button
                                key={lesson.id}
                                type="button"
                                onClick={() => handleLessonClick(lesson.id)}
                                className="group w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10"
                              >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                  <div className="h-20 w-full sm:h-16 sm:w-28 flex-shrink-0 overflow-hidden rounded-xl bg-slate-800">
                                    {module.thumbnail_url ? (
                                      <img
                                        src={module.thumbnail_url}
                                        alt={module.title || 'Módulo'}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="h-full w-full bg-gradient-to-br from-slate-700 via-slate-800 to-slate-700" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-400">
                                        {lessonIndex + 1}.
                                      </span>
                                      <h5 className="text-sm font-semibold text-white">
                                        {lesson.title || 'Aula'}
                                      </h5>
                                    </div>
                                    {lesson.description && (
                                      <p className="mt-1 text-xs text-slate-300 line-clamp-2">
                                        {lesson.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    Assistir
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentsList;
