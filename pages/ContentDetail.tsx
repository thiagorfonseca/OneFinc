import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../src/auth/AuthProvider';
import { useModalControls } from '../hooks/useModalControls';

interface ContentItem {
  id: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
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

const extractDurationSeconds = (payload: unknown) => {
  if (!payload) return null;
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      return extractDurationSeconds(parsed);
    } catch {
      return null;
    }
  }
  if (typeof payload !== 'object') return null;
  const data = payload as Record<string, any>;
  if (typeof data.duration === 'number') return data.duration;
  if (typeof data.totalDuration === 'number') return data.totalDuration;
  if (data.data) return extractDurationSeconds(data.data);
  return null;
};

const extractEventName = (payload: unknown): string | null => {
  if (!payload) return null;
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      return extractEventName(parsed);
    } catch {
      return payload;
    }
  }
  if (typeof payload !== 'object') return null;
  const data = payload as Record<string, any>;
  if (typeof data.eventName === 'string') return data.eventName;
  if (typeof data.event_type === 'string') return data.event_type;
  if (typeof data.status === 'string') return data.status;
  if (typeof data.event === 'string') return data.event;
  if (typeof data.type === 'string') return data.type;
  if (typeof data.name === 'string') return data.name;
  if (typeof data.action === 'string') return data.action;
  if (data.data) return extractEventName(data.data);
  return null;
};

const isPandaOrigin = (origin: string) => {
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname;
    return host.includes('pandavideo');
  } catch {
    return origin.includes('pandavideo');
  }
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
  const [moduleOpen, setModuleOpen] = useState<Record<string, boolean>>({});
  const [resumeSeconds, setResumeSeconds] = useState(0);
  const [lessonProgress, setLessonProgress] = useState<Record<string, number>>({});
  const lastSavedSecondsRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const autoAdvanceLessonRef = useRef<string | null>(null);

  const typeLabel = type === 'courses' ? 'Cursos' : 'Treinamentos';
  const typeLabelSingle = type === 'courses' ? 'Curso' : 'Treinamento';
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
          .select('id, title, order_index, thumbnail_url')
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

  const notesKey = useMemo(() => {
    if (!selectedLessonId) return null;
    return `lesson-notes:${selectedLessonId}`;
  }, [selectedLessonId]);

  const videoProgressKey = useMemo(() => {
    if (!selectedLessonId) return null;
    return `lesson-video-progress:${selectedLessonId}`;
  }, [selectedLessonId]);

  const contentProgressKey = useMemo(() => {
    if (!contentId) return null;
    return `content-progress:${contentId}`;
  }, [contentId]);

  const touchContentProgress = useCallback(
    (lessonId?: string | null) => {
      if (!contentProgressKey || typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(
          contentProgressKey,
          JSON.stringify({
            lessonId: lessonId || selectedLessonId || null,
            updatedAt: Date.now(),
          })
        );
      } catch {
        // ignore storage errors
      }
    },
    [contentProgressKey, selectedLessonId]
  );

  const updateLessonProgress = useCallback(
    (seconds: number) => {
      if (!selectedLessonId) return;
      setLessonProgress((prev) => {
        const next = { ...prev };
        if (seconds > 0) next[selectedLessonId] = seconds;
        else delete next[selectedLessonId];
        return next;
      });
    },
    [selectedLessonId]
  );

  const saveVideoProgress = useCallback(
    (seconds: number) => {
      if (!videoProgressKey || typeof window === 'undefined') return;
      const rounded = Math.max(0, Math.floor(seconds));
      if (rounded === lastSavedSecondsRef.current) return;
      lastSavedSecondsRef.current = rounded;
      try {
        window.localStorage.setItem(videoProgressKey, String(rounded));
        if (rounded > 0) touchContentProgress();
        updateLessonProgress(rounded);
      } catch {
        // Silencia erro de storage para não interromper a aula.
      }
    },
    [videoProgressKey, touchContentProgress, updateLessonProgress]
  );

  const saveCurrentProgress = useCallback(() => {
    if (videoRef.current) {
      saveVideoProgress(videoRef.current.currentTime || 0);
    }
  }, [saveVideoProgress]);

  const handleSelectLesson = useCallback(
    (lessonId: string, replace = false) => {
      saveCurrentProgress();
      touchContentProgress(lessonId);
      setSelectedLessonId(lessonId);
      setSearchParams({ lesson: lessonId }, { replace });
    },
    [saveCurrentProgress, setSearchParams, touchContentProgress]
  );

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

  const handleClearProgress = useCallback(() => {
    if (typeof window === 'undefined') return;
    orderedLessons.forEach((lesson) => {
      try {
        window.localStorage.removeItem(`lesson-video-progress:${lesson.id}`);
      } catch {
        // ignore storage errors
      }
    });
    if (contentProgressKey) {
      try {
        window.localStorage.removeItem(contentProgressKey);
      } catch {
        // ignore storage errors
      }
    }
    setLessonProgress({});
    setResumeSeconds(0);
    lastSavedSecondsRef.current = 0;
  }, [orderedLessons, contentProgressKey]);

  const loadLessonProgress = useCallback(() => {
    if (typeof window === 'undefined') return;
    const next: Record<string, number> = {};
    orderedLessons.forEach((lesson) => {
      try {
        const raw = window.localStorage.getItem(`lesson-video-progress:${lesson.id}`);
        const parsed = raw ? Number(raw) : 0;
        if (Number.isFinite(parsed) && parsed > 0) next[lesson.id] = parsed;
      } catch {
        // ignore storage errors
      }
    });
    setLessonProgress(next);
  }, [orderedLessons]);

  useEffect(() => {
    loadLessonProgress();
  }, [loadLessonProgress]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: StorageEvent) => {
      if (event.key?.startsWith('lesson-video-progress:')) {
        loadLessonProgress();
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [loadLessonProgress]);

  const currentLessonIndex = useMemo(() => {
    if (!selectedLessonId) return -1;
    return orderedLessons.findIndex((lesson) => lesson.id === selectedLessonId);
  }, [orderedLessons, selectedLessonId]);

  const currentModule = useMemo(() => {
    if (!selectedLessonId) return null;
    return modules.find((module) => module.lessons.some((lesson) => lesson.id === selectedLessonId)) || null;
  }, [modules, selectedLessonId]);

  const previousLesson = currentLessonIndex > 0 ? orderedLessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex >= 0 && currentLessonIndex < orderedLessons.length - 1
      ? orderedLessons[currentLessonIndex + 1]
      : null;

  const totalLessons = orderedLessons.length;
  const completedLessons = orderedLessons.filter((lesson) => lessonProgress[lesson.id] > 0).length;
  const progressPercent = totalLessons
    ? Math.min(100, Math.round((completedLessons / totalLessons) * 100))
    : 0;

  const handleAutoAdvance = useCallback(() => {
    if (!nextLesson || !selectedLessonId) return;
    if (autoAdvanceLessonRef.current === selectedLessonId) return;
    autoAdvanceLessonRef.current = selectedLessonId;
    handleSelectLesson(nextLesson.id);
  }, [nextLesson, handleSelectLesson, selectedLessonId]);

  useEffect(() => {
    autoAdvanceLessonRef.current = null;
  }, [selectedLessonId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow || null;
      const matchesIframe = iframeWindow && event.source === iframeWindow;
      if (!matchesIframe && !isPandaOrigin(event.origin)) return;
      const seconds = extractProgressSeconds(event.data);
      if (typeof seconds === 'number' && Number.isFinite(seconds)) {
        saveVideoProgress(seconds);
      }
      const eventName = extractEventName(event.data);
      const duration = extractDurationSeconds(event.data);
      if (eventName) {
        const normalized = eventName.toLowerCase();
        if (
          normalized.includes('ended') ||
          normalized.includes('finish') ||
          normalized.includes('complete') ||
          normalized === 'end'
        ) {
          handleAutoAdvance();
        }
        return;
      }
      if (
        typeof seconds === 'number' &&
        typeof duration === 'number' &&
        duration > 0 &&
        seconds >= duration - 0.5
      ) {
        handleAutoAdvance();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [saveVideoProgress, handleAutoAdvance]);

  const filteredModules = useMemo(() => modules, [modules]);

  const toggleLights = useCallback(() => {
    saveCurrentProgress();
    setLightsOff((prev) => !prev);
  }, [saveCurrentProgress]);

  const closeLights = useCallback(() => {
    saveCurrentProgress();
    setLightsOff(false);
  }, [saveCurrentProgress]);

  const lightsModalControls = useModalControls({
    isOpen: lightsOff,
    onClose: closeLights,
  });

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
  const withAutoplay = useCallback((url: string | null) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      parsed.searchParams.set('autoplay', '1');
      return parsed.toString();
    } catch {
      const joiner = url.includes('?') ? '&' : '?';
      return `${url}${joiner}autoplay=1`;
    }
  }, []);
  const iframeVideoUrl = useMemo(
    () => (isDirectVideo ? null : withAutoplay(withStartTime(baseVideoUrl, resumeSeconds))),
    [baseVideoUrl, isDirectVideo, resumeSeconds, withAutoplay]
  );
  const videoPanel = (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {baseVideoUrl ? (
        <div className="w-full aspect-video bg-black">
          {isDirectVideo ? (
            <video
              ref={videoRef}
              src={baseVideoUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full"
              onLoadedMetadata={() => {
                if (resumeSeconds > 0 && videoRef.current) {
                  videoRef.current.currentTime = resumeSeconds;
                }
              }}
              onTimeUpdate={(e) => saveVideoProgress(e.currentTarget.currentTime)}
              onPause={(e) => saveVideoProgress(e.currentTarget.currentTime)}
              onEnded={() => {
                saveVideoProgress(0);
                handleAutoAdvance();
              }}
            />
          ) : (
            <iframe
              key={`${selectedLesson?.id || 'lesson'}-${Math.floor(resumeSeconds)}`}
              ref={iframeRef}
              src={iframeVideoUrl || baseVideoUrl}
              title={selectedLesson?.title || 'Aula'}
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-56 text-sm text-gray-500">
          Link do vídeo não informado.
        </div>
      )}
      <div className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-gray-400">Aula atual</p>
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedLesson?.title || 'Selecione uma aula'}
          </h2>
          {currentModule && (
            <p className="text-xs text-gray-500 mt-1">{currentModule.title || 'Módulo'}</p>
          )}
        </div>
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
    </div>
  );

  const lessonTabs = (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-4 shadow-sm">
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
            {selectedLesson?.description ? (
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
            {!commentsLoading && commentsError && <p>Comentários indisponíveis no momento.</p>}
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
    </div>
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Link
            className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline"
            to={basePath}
          >
            ← Voltar para {typeLabel}
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">{content.title || 'Sem título'}</h1>
          {content.description && <p className="text-gray-500">{content.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleClearProgress}
            className="px-3 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
          >
            Apagar progresso
          </button>
          <button
            type="button"
            onClick={toggleLights}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            {lightsOff ? 'Acender as luzes' : 'Apagar as luzes'}
          </button>
        </div>
      </div>

      {lightsOff && (
        <div
          className="fixed inset-0 bg-black/80 z-50 overflow-y-auto"
          onClick={lightsModalControls.onBackdropClick}
        >
          <div className="min-h-full flex items-center justify-center p-6">
            <div className="w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-end pb-3">
                <button
                  type="button"
                  onClick={closeLights}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Acender as luzes
                </button>
              </div>
              {videoPanel}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-4">
          {videoPanel}
          {lessonTabs}
        </div>

        <aside className="rounded-2xl bg-[#0883c6] text-white p-5 space-y-5 shadow-lg">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-white/70">{typeLabelSingle}</p>
            <h2 className="text-xl font-semibold text-white">{content.title || 'Sem título'}</h2>
            <p className="text-xs text-white/70">
              {modules.length} módulo{modules.length === 1 ? '' : 's'} • {totalLessons} aula{totalLessons === 1 ? '' : 's'}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-white/70">
              <span>Progresso do curso</span>
              <span className="text-sm font-semibold text-white">{progressPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-brand-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-white/70">
              {completedLessons} de {totalLessons} aulas assistidas
            </p>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {filteredModules.length === 0 ? (
              <p className="text-xs text-white/70">Nenhuma aula publicada.</p>
            ) : (
              filteredModules.map((module, moduleIndex) => (
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
                  className="rounded-2xl border border-white/10 bg-white/5 p-3"
                >
                  <summary className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {module.title || `Módulo ${moduleIndex + 1}`}
                      </p>
                      <p className="text-xs text-white/70">
                        {module.lessons.length} aula{module.lessons.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span className="text-xs text-white/70">Ver aulas</span>
                  </summary>
                  <div className="mt-3 space-y-2">
                    {module.lessons.length === 0 && (
                      <p className="text-xs text-white/70">Sem aulas neste módulo.</p>
                    )}
                    {module.lessons.map((lesson, lessonIndex) => {
                      const isActive = selectedLessonId === lesson.id;
                      const hasProgress = lessonProgress[lesson.id] > 0;
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => handleSelectLesson(lesson.id)}
                          className={`w-full text-left rounded-xl border px-3 py-2 transition ${
                            isActive
                              ? 'border-brand-500 bg-brand-500/10'
                              : 'border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="h-16 w-full sm:w-24 flex-shrink-0 overflow-hidden rounded-lg bg-slate-800">
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
                                <span className="text-xs text-white/60">{lessonIndex + 1}.</span>
                                <p className="text-sm font-semibold text-white">
                                  {lesson.title || 'Aula'}
                                </p>
                                <span
                                  className={`ml-auto h-2 w-2 rounded-full ${
                                    hasProgress ? 'bg-emerald-400' : 'bg-white/20'
                                  }`}
                                />
                              </div>
                              {lesson.description && (
                                <p className="mt-1 text-xs text-white/80 line-clamp-2">
                                  {lesson.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </details>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ContentDetail;
