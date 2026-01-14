import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../src/auth/AuthProvider';

interface ContentItem {
  id: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
}

interface ContentSidebarItem {
  id: string;
  title: string | null;
  thumbnail_url: string | null;
  created_at: string | null;
}

interface ContentModule {
  id: string;
  title: string | null;
  order_index: number | null;
}

interface ContentLesson {
  id: string;
  module_id: string | null;
  title: string | null;
  description: string | null;
  panda_video_id: string | null;
  panda_video_url: string | null;
  order_index: number | null;
}

interface ModuleWithLessons extends ContentModule {
  lessons: ContentLesson[];
}

interface ContentLessonFile {
  id: string;
  file_name: string | null;
  file_url: string | null;
  created_at: string | null;
}

interface ContentComment {
  id: string;
  content: string | null;
  status: string | null;
  created_at: string | null;
  student_user_id: string | null;
}

const isDirectVideoUrl = (url: string | null) => {
  if (!url) return false;
  return /\.(mp4|m3u8|webm|ogg)(\?|#|$)/i.test(url);
};

const withStartTime = (url: string | null, seconds: number) => {
  if (!url) return null;
  if (!seconds || seconds <= 0) return url;
  const startAt = Math.max(0, Math.floor(seconds));
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('t', String(startAt));
    return parsed.toString();
  } catch {
    const joiner = url.includes('?') ? '&' : '?';
    return `${url}${joiner}t=${startAt}`;
  }
};

const extractProgressSeconds = (payload: unknown) => {
  if (!payload) return null;
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      return extractProgressSeconds(parsed);
    } catch {
      return null;
    }
  }
  if (typeof payload !== 'object') return null;
  const data = payload as Record<string, any>;
  if (typeof data.currentTime === 'number') return data.currentTime;
  if (typeof data.seconds === 'number') return data.seconds;
  if (typeof data.time === 'number') return data.time;
  if (data.data) return extractProgressSeconds(data.data);
  return null;
};

const ContentDetail: React.FC = () => {
  const { type, contentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { clinicId, clinicPackageIds } = useAuth();
  const lessonParam = useMemo(() => searchParams.get('lesson'), [searchParams]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [content, setContent] = useState<ContentItem | null>(null);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [relatedContents, setRelatedContents] = useState<ContentSidebarItem[]>([]);
  const [activeTab, setActiveTab] = useState<'description' | 'notes' | 'comments' | 'files'>('description');
  const [lessonNotes, setLessonNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState('');
  const [notesEditing, setNotesEditing] = useState(false);
  const [lessonFiles, setLessonFiles] = useState<ContentLessonFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentAuthors, setCommentAuthors] = useState<Record<string, string>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [lightsOff, setLightsOff] = useState(false);
  const [relatedCollapsed, setRelatedCollapsed] = useState(true);
  const [modulesCollapsed, setModulesCollapsed] = useState(false);
  const [moduleSearch, setModuleSearch] = useState('');
  const [moduleOpen, setModuleOpen] = useState<Record<string, boolean>>({});
  const [resumeSeconds, setResumeSeconds] = useState(0);
  const lastSavedSecondsRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const typeLabel = type === 'courses' ? 'Cursos' : 'Treinamentos';
  const basePath = type === 'courses' ? '/contents/courses' : '/contents/trainings';

  useEffect(() => {
    const load = async () => {
      if (!contentId || !type) {
        setLoadError('Conteúdo inválido.');
        setLoading(false);
        return;
      }
      if (type !== 'courses' && type !== 'trainings') {
        setLoadError('Tipo de conteúdo inválido.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        if (clinicId && clinicPackageIds.length) {
          const { data: allowed, error: allowedError } = await (supabase as any)
            .from('content_package_items')
            .select('id')
            .in('package_id', clinicPackageIds)
            .eq('content_id', contentId)
            .maybeSingle();
          if (allowedError) throw allowedError;
          if (!allowed) {
            setLoadError('Conteúdo não liberado para sua clínica.');
            setLoading(false);
            return;
          }
        }
        const contentType = type === 'courses' ? 'course' : 'training';
        const { data: contentData, error: contentError } = await supabase
          .from('content_items')
          .select('id, title, description, thumbnail_url')
          .eq('id', contentId)
          .eq('type', contentType)
          .maybeSingle();
        if (contentError) throw contentError;
        setContent((contentData as ContentItem) || null);

        const { data: modulesData, error: modulesError } = await supabase
          .from('content_modules')
          .select('id, title, order_index')
          .eq('content_id', contentId)
          .order('order_index', { ascending: true });
        if (modulesError) throw modulesError;

        const modulesList = (modulesData || []) as ContentModule[];
        if (!modulesList.length) {
          setModules([]);
          setLoading(false);
          return;
        }

        const moduleIds = modulesList.map((module) => module.id);
        const { data: lessonsData, error: lessonsError } = await supabase
          .from('content_lessons')
          .select('id, module_id, title, description, panda_video_id, panda_video_url, order_index')
          .in('module_id', moduleIds)
          .order('order_index', { ascending: true });
        if (lessonsError) throw lessonsError;

        const lessonsList = (lessonsData || []) as ContentLesson[];
        const byModule: Record<string, ContentLesson[]> = {};
        lessonsList.forEach((lesson) => {
          if (!lesson.module_id) return;
          if (!byModule[lesson.module_id]) byModule[lesson.module_id] = [];
          byModule[lesson.module_id].push(lesson);
        });

        const merged = modulesList.map((module) => ({
          ...module,
          lessons: byModule[module.id] || [],
        }));
        setModules(merged);
        setLoading(false);
      } catch (error) {
        const message = (error as Error).message || 'Erro inesperado ao carregar conteúdo.';
        setLoadError(message);
        setContent(null);
        setModules([]);
        setLoading(false);
      }
    };

    load();
  }, [contentId, type, clinicId, clinicPackageIds]);

  useEffect(() => {
    const loadRelated = async () => {
      if (!type || (type !== 'courses' && type !== 'trainings')) return;
      const contentType = type === 'courses' ? 'course' : 'training';
      try {
        if (clinicId && clinicPackageIds.length) {
          const { data, error } = await (supabase as any)
            .from('content_package_items')
            .select('content_items (id, title, thumbnail_url, created_at, type, published)')
            .in('package_id', clinicPackageIds);
          if (error) throw error;
          const map = new Map<string, ContentSidebarItem>();
          (data || []).forEach((row: any) => {
            const item = row.content_items;
            if (!item || item.published !== true || item.type !== contentType) return;
            if (!map.has(item.id)) {
              map.set(item.id, {
                id: item.id,
                title: item.title,
                thumbnail_url: item.thumbnail_url,
                created_at: item.created_at,
              });
            }
          });
          const list = Array.from(map.values()).sort((a, b) =>
            (b.created_at || '').localeCompare(a.created_at || '')
          );
          setRelatedContents(list);
        } else {
          const { data, error } = await supabase
            .from('content_items')
            .select('id, title, thumbnail_url, created_at')
            .eq('type', contentType)
            .eq('published', true)
            .order('created_at', { ascending: false });
          if (error) throw error;
          setRelatedContents((data || []) as ContentSidebarItem[]);
        }
      } catch {
        setRelatedContents([]);
      }
    };
    loadRelated();
  }, [type, clinicId, clinicPackageIds]);

  const notesKey = useMemo(() => {
    if (!selectedLessonId) return null;
    return `lesson-notes:${selectedLessonId}`;
  }, [selectedLessonId]);

  const videoProgressKey = useMemo(() => {
    if (!selectedLessonId) return null;
    return `lesson-video-progress:${selectedLessonId}`;
  }, [selectedLessonId]);

  const saveVideoProgress = useCallback(
    (seconds: number) => {
      if (!videoProgressKey || typeof window === 'undefined') return;
      const rounded = Math.max(0, Math.floor(seconds));
      if (rounded === lastSavedSecondsRef.current) return;
      lastSavedSecondsRef.current = rounded;
      try {
        window.localStorage.setItem(videoProgressKey, String(rounded));
      } catch {
        // Silencia erro de storage para não interromper a aula.
      }
    },
    [videoProgressKey]
  );

  const saveCurrentProgress = useCallback(() => {
    if (videoRef.current) {
      saveVideoProgress(videoRef.current.currentTime || 0);
    }
  }, [saveVideoProgress]);

  useEffect(() => {
    if (!notesKey) {
      setLessonNotes('');
      setNotesSaved('');
      setNotesEditing(false);
      return;
    }
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(notesKey);
      const value = stored || '';
      setLessonNotes(value);
      setNotesSaved(value);
      setNotesEditing(value.length === 0);
    } catch {
      setLessonNotes('');
      setNotesSaved('');
      setNotesEditing(true);
    }
  }, [notesKey]);

  useEffect(() => {
    if (!videoProgressKey) {
      setResumeSeconds(0);
      lastSavedSecondsRef.current = 0;
      return;
    }
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(videoProgressKey);
      const parsed = stored ? Number(stored) : 0;
      const value = Number.isFinite(parsed) ? parsed : 0;
      setResumeSeconds(value);
      lastSavedSecondsRef.current = 0;
    } catch {
      setResumeSeconds(0);
      lastSavedSecondsRef.current = 0;
    }
  }, [videoProgressKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: MessageEvent) => {
      if (!event.origin.includes('pandavideo.com.br')) return;
      const seconds = extractProgressSeconds(event.data);
      if (typeof seconds === 'number' && Number.isFinite(seconds)) {
        saveVideoProgress(seconds);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [saveVideoProgress]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (resumeSeconds <= 0) return;
    try {
      videoRef.current.currentTime = resumeSeconds;
    } catch {
      // Ignora falhas ao restaurar posição do vídeo.
    }
  }, [resumeSeconds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleVisibility = () => {
      if (document.hidden) saveCurrentProgress();
    };
    window.addEventListener('beforeunload', saveCurrentProgress);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', saveCurrentProgress);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [saveCurrentProgress]);

  useEffect(() => {
    const loadFiles = async () => {
      if (!selectedLessonId) {
        setLessonFiles([]);
        setFilesError(null);
        return;
      }
      setFilesLoading(true);
      setFilesError(null);
      try {
        const { data, error } = await supabase
          .from('content_lesson_files')
          .select('id, file_name, file_url, created_at')
          .eq('lesson_id', selectedLessonId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setLessonFiles((data || []) as ContentLessonFile[]);
      } catch (error) {
        setFilesError((error as Error).message);
        setLessonFiles([]);
      }
      setFilesLoading(false);
    };
    loadFiles();
  }, [selectedLessonId]);

  useEffect(() => {
    const loadComments = async () => {
      if (!contentId) {
        setComments([]);
        setCommentsError(null);
        return;
      }
      setCommentsLoading(true);
      setCommentsError(null);
      try {
        let query = supabase
          .from('content_comments')
          .select('id, content, status, created_at, student_user_id')
          .eq('content_id', contentId)
          .order('created_at', { ascending: false });
        if (selectedLessonId) {
          query = query.eq('lesson_id', selectedLessonId);
        }
        const { data, error } = await query;
        if (error) throw error;
        setComments((data || []) as ContentComment[]);
      } catch (error) {
        setCommentsError((error as Error).message);
        setComments([]);
      }
      setCommentsLoading(false);
    };
    loadComments();
  }, [contentId, selectedLessonId]);

  useEffect(() => {
    if (!modules.length) {
      setModuleOpen({});
      return;
    }
    setModuleOpen((prev) => {
      const next: Record<string, boolean> = {};
      modules.forEach((module) => {
        next[module.id] = prev[module.id] ?? true;
      });
      return next;
    });
  }, [modules]);

  useEffect(() => {
    const loadAuthors = async () => {
      const userIds = Array.from(
        new Set(comments.map((comment) => comment.student_user_id).filter((id) => Boolean(id)))
      ) as string[];
      if (!userIds.length) {
        setCommentAuthors({});
        return;
      }
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        if (error) throw error;
        const mapped: Record<string, string> = {};
        (data || []).forEach((row) => {
          mapped[row.id as string] = (row as { full_name?: string | null }).full_name || 'Usuário';
        });
        setCommentAuthors(mapped);
      } catch {
        setCommentAuthors({});
      }
    };
    loadAuthors();
  }, [comments]);

  const selectedLesson = useMemo(() => {
    if (!selectedLessonId) return null;
    for (const module of modules) {
      const lesson = module.lessons.find((l) => l.id === selectedLessonId);
      if (lesson) return lesson;
    }
    return null;
  }, [modules, selectedLessonId]);

  const orderedLessons = useMemo(() => {
    const sortedModules = [...modules].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    );
    return sortedModules.flatMap((module) =>
      [...module.lessons].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    );
  }, [modules]);

  const currentLessonIndex = useMemo(() => {
    if (!selectedLessonId) return -1;
    return orderedLessons.findIndex((lesson) => lesson.id === selectedLessonId);
  }, [orderedLessons, selectedLessonId]);

  const previousLesson = currentLessonIndex > 0 ? orderedLessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex >= 0 && currentLessonIndex < orderedLessons.length - 1
      ? orderedLessons[currentLessonIndex + 1]
      : null;

  const filteredModules = useMemo(() => {
    const term = moduleSearch.trim().toLowerCase();
    if (!term) return modules;
    const result: ModuleWithLessons[] = [];
    modules.forEach((module) => {
      const moduleTitle = module.title?.toLowerCase() || '';
      const matchingLessons = module.lessons.filter((lesson) => {
        const lessonTitle = lesson.title?.toLowerCase() || '';
        return lessonTitle.includes(term);
      });
      if (moduleTitle.includes(term)) {
        result.push(module);
        return;
      }
      if (matchingLessons.length) {
        result.push({ ...module, lessons: matchingLessons });
      }
    });
    return result;
  }, [modules, moduleSearch]);

  const allModulesOpen = useMemo(() => {
    const values = Object.values(moduleOpen);
    if (!values.length) return false;
    return values.every(Boolean);
  }, [moduleOpen]);

  const toggleAllModules = () => {
    setModuleOpen((prev) => {
      const shouldOpen = !allModulesOpen;
      const next: Record<string, boolean> = {};
      Object.keys(prev).forEach((id) => {
        next[id] = shouldOpen;
      });
      return next;
    });
  };

  const handleSelectLesson = useCallback(
    (lessonId: string, replace = false) => {
      saveCurrentProgress();
      setSelectedLessonId(lessonId);
      setSearchParams({ lesson: lessonId }, { replace });
    },
    [saveCurrentProgress, setSearchParams]
  );

  const toggleLights = useCallback(() => {
    saveCurrentProgress();
    setLightsOff((prev) => !prev);
  }, [saveCurrentProgress]);

  const closeLights = useCallback(() => {
    saveCurrentProgress();
    setLightsOff(false);
  }, [saveCurrentProgress]);

  useEffect(() => {
    const allLessons = modules.flatMap((m) => m.lessons);
    if (lessonParam) {
      const exists = allLessons.some((lesson) => lesson.id === lessonParam);
      if (exists) {
        setSelectedLessonId(lessonParam);
        return;
      }
    }
    const firstLesson = allLessons[0];
    if (firstLesson) {
      handleSelectLesson(firstLesson.id, true);
    }
  }, [modules, lessonParam, handleSelectLesson]);

  const handleNotesChange = (value: string) => {
    setLessonNotes(value);
  };

  const handleNotesSave = () => {
    if (!notesKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(notesKey, lessonNotes);
      setNotesSaved(lessonNotes);
      setNotesEditing(false);
    } catch {
      setNotesSaved('');
    }
  };

  const handleNotesDelete = () => {
    if (!notesKey || typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(notesKey);
      setLessonNotes('');
      setNotesSaved('');
      setNotesEditing(false);
    } catch {
      setLessonNotes('');
      setNotesSaved('');
      setNotesEditing(true);
    }
  };

  const filesCountLabel = lessonFiles.length === 1 ? '1 arquivo' : `${lessonFiles.length} arquivos`;
  const baseVideoUrl = useMemo(() => {
    if (!selectedLesson) return null;
    return (
      selectedLesson.panda_video_url ||
      (selectedLesson.panda_video_id
        ? `https://player.pandavideo.com.br/embed/?v=${selectedLesson.panda_video_id}`
        : null)
    );
  }, [selectedLesson]);
  const isDirectVideo = useMemo(() => isDirectVideoUrl(baseVideoUrl), [baseVideoUrl]);
  const iframeVideoUrl = useMemo(
    () => (isDirectVideo ? null : withStartTime(baseVideoUrl, resumeSeconds)),
    [baseVideoUrl, isDirectVideo, resumeSeconds]
  );
  const relatedWidth = relatedCollapsed ? '56px' : '240px';
  const modulesWidth = modulesCollapsed ? '56px' : '300px';
  const gridTemplate = `${relatedWidth} ${modulesWidth} minmax(0,1fr)`;

  const lessonPanel = (variant: 'grid' | 'modal') => (
    <section
      className={
        variant === 'grid'
          ? 'order-1 lg:order-3 bg-white border border-gray-100 rounded-xl p-4 space-y-4'
          : 'bg-white border border-gray-100 rounded-xl p-4 space-y-4 shadow-xl'
      }
    >
      {selectedLesson ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-800">{selectedLesson.title || 'Aula'}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => previousLesson && handleSelectLesson(previousLesson.id)}
                disabled={!previousLesson}
                className="px-3 py-2 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Aula anterior
              </button>
              <button
                type="button"
                onClick={() => nextLesson && handleSelectLesson(nextLesson.id)}
                disabled={!nextLesson}
                className="px-3 py-2 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Próxima aula
              </button>
            </div>
          </div>
          {baseVideoUrl ? (
            <div className="w-full aspect-video rounded-lg overflow-hidden border border-gray-100 bg-black">
              {isDirectVideo ? (
                <video
                  ref={videoRef}
                  src={baseVideoUrl}
                  controls
                  playsInline
                  className="w-full h-full"
                  onLoadedMetadata={() => {
                    if (resumeSeconds > 0 && videoRef.current) {
                      videoRef.current.currentTime = resumeSeconds;
                    }
                  }}
                  onTimeUpdate={(e) => saveVideoProgress(e.currentTarget.currentTime)}
                  onPause={(e) => saveVideoProgress(e.currentTarget.currentTime)}
                  onEnded={() => saveVideoProgress(0)}
                />
              ) : (
                <iframe
                  key={`${selectedLesson.id}-${Math.floor(resumeSeconds)}`}
                  src={iframeVideoUrl || baseVideoUrl}
                  title={selectedLesson.title || 'Aula'}
                  className="w-full h-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">Link do vídeo não informado.</div>
          )}

          <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-2">
            {[
              { key: 'description', label: 'Descrição' },
              { key: 'notes', label: 'Anotações' },
              { key: 'comments', label: 'Comentários' },
              { key: 'files', label: `Arquivos • ${filesCountLabel}` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-3 py-2 text-sm rounded-lg border ${
                  activeTab === tab.key
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="pt-2">
            {activeTab === 'description' && (
              <div className="space-y-2 text-sm text-gray-600">
                {selectedLesson.description ? (
                  <p>{selectedLesson.description}</p>
                ) : content?.description ? (
                  <p>{content?.description}</p>
                ) : (
                  <p>Sem descrição disponível.</p>
                )}
              </div>
            )}
            {activeTab === 'notes' && (
              <div className="space-y-2">
                <textarea
                  value={lessonNotes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder="Escreva suas anotações aqui..."
                  rows={5}
                  readOnly={!notesEditing}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    notesEditing ? 'border-gray-300' : 'border-gray-200 bg-gray-50'
                  }`}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleNotesSave}
                    disabled={!notesEditing}
                    className="px-3 py-2 text-xs rounded-lg bg-brand-600 text-white disabled:opacity-50"
                  >
                    Gravar
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesEditing(true)}
                    className="px-3 py-2 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={handleNotesDelete}
                    className="px-3 py-2 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Apagar
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  {notesSaved ? 'Anotação salva neste navegador.' : 'Nenhuma anotação salva.'}
                </p>
              </div>
            )}
            {activeTab === 'comments' && (
              <div className="space-y-3 text-sm text-gray-600">
                {commentsLoading && <p>Carregando comentários...</p>}
                {!commentsLoading && commentsError && (
                  <p>Comentários indisponíveis no momento.</p>
                )}
                {!commentsLoading && !commentsError && comments.length === 0 && (
                  <p>Nenhum comentário.</p>
                )}
                {!commentsLoading && !commentsError && comments.length > 0 && (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <div key={comment.id} className="border border-gray-100 rounded-lg p-3">
                        <p className="text-xs text-gray-400">
                          {commentAuthors[comment.student_user_id || ''] || 'Usuário'} •{' '}
                          {comment.created_at?.slice(0, 10) || 'Sem data'}
                        </p>
                        <p className="text-sm text-gray-700 mt-1">{comment.content || 'Sem conteúdo.'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'files' && (
              <div className="space-y-2 text-sm text-gray-600">
                {filesLoading && <p>Carregando arquivos...</p>}
                {!filesLoading && filesError && <p>Arquivos indisponíveis no momento.</p>}
                {!filesLoading && !filesError && lessonFiles.length === 0 && (
                  <p>Nenhum arquivo disponível.</p>
                )}
                {!filesLoading && !filesError && lessonFiles.length > 0 && (
                  <div className="space-y-2">
                    {lessonFiles.map((file) => (
                      <a
                        key={file.id}
                        href={file.file_url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between border border-gray-100 rounded-lg p-3 hover:bg-gray-50"
                      >
                        <span>{file.file_name || 'Arquivo'}</span>
                        <span className="text-xs text-gray-400">Abrir</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-sm text-gray-500">Selecione uma aula para começar.</div>
      )}
    </section>
  );

  if (loading) {
    return <div className="h-48 flex items-center justify-center text-gray-500">Carregando conteúdo...</div>;
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-gray-800">Erro ao carregar conteúdo</h1>
        <p className="text-sm text-gray-500">{loadError}</p>
        <Link className="text-brand-600 hover:underline" to={basePath}>
          Voltar para {typeLabel}
        </Link>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-gray-800">Conteúdo não encontrado</h1>
        <Link className="text-brand-600 hover:underline" to={basePath}>
          Voltar para {typeLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link className="text-sm text-brand-600 hover:underline" to={basePath}>
            ← Voltar para {typeLabel}
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-2">{content.title || 'Sem título'}</h1>
          {content.description && <p className="text-gray-500">{content.description}</p>}
        </div>
        <button
          type="button"
          onClick={toggleLights}
          className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
        >
          {lightsOff ? 'Acender as luzes' : 'Apagar as luzes'}
        </button>
      </div>

      {lightsOff && (
        <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto" onClick={closeLights}>
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-end pb-2">
                <button
                  type="button"
                  onClick={closeLights}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Acender as luzes
                </button>
              </div>
              {lessonPanel('modal')}
            </div>
          </div>
        </div>
      )}

      <div
        className="grid grid-cols-1 gap-4 lg:[grid-template-columns:var(--content-grid)]"
        style={{ '--content-grid': gridTemplate } as React.CSSProperties}
      >
        <aside className="order-2 lg:order-1 bg-white border border-gray-100 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            {!relatedCollapsed && (
              <p className="text-sm font-semibold text-gray-700">Outros {typeLabel}</p>
            )}
            <button
              type="button"
              onClick={() => setRelatedCollapsed((prev) => !prev)}
              className="ml-auto text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              {relatedCollapsed ? 'Abrir' : 'Recolher'}
            </button>
          </div>
          {relatedCollapsed ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="text-xs text-gray-400">Cursos</div>
              {relatedContents.slice(0, 3).map((item) => (
                <Link
                  key={item.id}
                  to={`${basePath}/${item.id}`}
                  className="w-10 h-10 rounded-md border border-gray-100 overflow-hidden"
                >
                  {item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt={item.title || 'Conteúdo'} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-100" />
                  )}
                </Link>
              ))}
            </div>
          ) : relatedContents.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum conteúdo publicado.</p>
          ) : (
            <div className="space-y-2">
              {relatedContents.map((item) => {
                const isActive = item.id === contentId;
                return (
                  <Link
                    key={item.id}
                    to={`${basePath}/${item.id}`}
                    className={`flex gap-3 items-center border rounded-lg p-2 transition ${
                      isActive
                        ? 'border-brand-200 bg-brand-50 text-brand-700'
                        : 'border-gray-100 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt={item.title || 'Conteúdo'}
                        className="w-12 h-12 rounded-md object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-gray-100" />
                    )}
                    <div className="text-sm font-medium line-clamp-2">{item.title || 'Sem título'}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </aside>

        <aside className="order-3 lg:order-2 bg-white border border-gray-100 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            {!modulesCollapsed && <p className="text-sm font-semibold text-gray-700">Módulos</p>}
            <div className="flex items-center gap-2 ml-auto">
              {!modulesCollapsed && (
                <button
                  type="button"
                  onClick={toggleAllModules}
                  className="text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  {allModulesOpen ? 'Recolher tudo' : 'Abrir tudo'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setModulesCollapsed((prev) => !prev)}
                className="text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                {modulesCollapsed ? 'Abrir' : 'Recolher'}
              </button>
            </div>
          </div>
          {modulesCollapsed ? (
            <div className="flex flex-col items-center gap-2 py-2 text-xs text-gray-400">
              Módulos
            </div>
          ) : (
            <>
              <input
                value={moduleSearch}
                onChange={(e) => setModuleSearch(e.target.value)}
                placeholder="Buscar tema..."
                className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg"
              />
              {filteredModules.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma aula publicada.</p>
              ) : (
                <div className="space-y-2">
                  {filteredModules.map((module) => (
                    <details
                      key={module.id}
                      open={moduleOpen[module.id]}
                      onToggle={(e) => {
                        const nextOpen = (e.currentTarget as HTMLDetailsElement | null)?.open ?? false;
                        setModuleOpen((prev) => ({
                          ...prev,
                          [module.id]: nextOpen,
                        }));
                      }}
                      className="border border-gray-100 rounded-lg p-3"
                    >
                      <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                        {module.title || 'Sem módulo'}
                      </summary>
                      <div className="mt-2 space-y-1">
                        {module.lessons.length === 0 && (
                          <p className="text-xs text-gray-500">Sem aulas neste módulo.</p>
                        )}
                        {module.lessons.map((lesson) => (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={() => {
                              handleSelectLesson(lesson.id);
                            }}
                            className={`w-full text-left text-sm px-2 py-1 rounded-md ${
                              selectedLessonId === lesson.id
                                ? 'bg-brand-50 text-brand-700'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {lesson.title || 'Aula sem título'}
                          </button>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </>
          )}
        </aside>

        {!lightsOff && lessonPanel('grid')}
      </div>
    </div>
  );
};

export default ContentDetail;
