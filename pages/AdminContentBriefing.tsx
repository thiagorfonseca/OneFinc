import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type ClinicOption = {
  id: string;
  name: string;
};

type RequiredLesson = {
  id: string;
  title: string | null;
  meeting_tag: string | null;
  content_modules?: {
    id: string;
    title: string | null;
    content_items?: {
      id: string;
      title: string | null;
      type: string | null;
    } | null;
  } | null;
};

type ClinicUser = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
};

type LessonProgress = {
  user_id: string;
  lesson_id: string;
  watched_percent: number | null;
  watched_seconds: number | null;
  duration_seconds: number | null;
  last_watched_at: string | null;
  completed_at: string | null;
};

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', hour12: false }) : '—';

const AdminContentBriefing: React.FC = () => {
  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [meetingTags, setMeetingTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [requiredLessons, setRequiredLessons] = useState<RequiredLesson[]>([]);
  const [clinicUsers, setClinicUsers] = useState<ClinicUser[]>([]);
  const [progressRows, setProgressRows] = useState<LessonProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadClinics = async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name')
        .order('name', { ascending: true });
      if (error) {
        setError(error.message);
        return;
      }
      const list = (data || []) as ClinicOption[];
      setClinics(list);
      if (!selectedClinicId && list.length) {
        setSelectedClinicId(list[0].id);
      }
    };
    loadClinics();
  }, [selectedClinicId]);

  useEffect(() => {
    const loadTags = async () => {
      const { data, error } = await supabase
        .from('content_lessons')
        .select('meeting_tag')
        .eq('required_for_meeting', true)
        .not('meeting_tag', 'is', null);
      if (error) return;
      const unique = Array.from(
        new Set((data || []).map((row: any) => row.meeting_tag).filter((tag: string | null) => !!tag))
      ) as string[];
      setMeetingTags(unique);
    };
    loadTags();
  }, []);

  useEffect(() => {
    const loadBriefing = async () => {
      if (!selectedClinicId) return;
      setLoading(true);
      setError(null);
      try {
        let lessonsQuery = supabase
          .from('content_lessons')
          .select(
            'id, title, meeting_tag, content_modules (id, title, content_items (id, title, type))'
          )
          .eq('required_for_meeting', true)
          .order('order_index', { ascending: true });
        if (selectedTag !== 'all') {
          lessonsQuery = lessonsQuery.eq('meeting_tag', selectedTag);
        }
        const { data: lessonsData, error: lessonsError } = await lessonsQuery;
        if (lessonsError) throw lessonsError;
        const lessons = (lessonsData || []) as RequiredLesson[];
        setRequiredLessons(lessons);

        const { data: usersData, error: usersError } = await supabase
          .from('clinic_users')
          .select('id, user_id, name, email')
          .eq('clinic_id', selectedClinicId)
          .eq('ativo', true);
        if (usersError) throw usersError;
        const users = (usersData || []).filter((row) => row.user_id) as ClinicUser[];
        setClinicUsers(users);

        if (!lessons.length) {
          setProgressRows([]);
          setLoading(false);
          return;
        }

        const lessonIds = lessons.map((lesson) => lesson.id);
        const { data: progressData, error: progressError } = await supabase
          .from('content_lesson_progress')
          .select('user_id, lesson_id, watched_percent, watched_seconds, duration_seconds, last_watched_at, completed_at')
          .eq('clinic_id', selectedClinicId)
          .in('lesson_id', lessonIds);
        if (progressError) throw progressError;
        setProgressRows((progressData || []) as LessonProgress[]);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar briefing.');
      } finally {
        setLoading(false);
      }
    };
    loadBriefing();
  }, [selectedClinicId, selectedTag]);

  const requiredCount = requiredLessons.length;

  const progressByUser = useMemo(() => {
    const map = new Map<string, LessonProgress[]>();
    progressRows.forEach((row) => {
      if (!map.has(row.user_id)) map.set(row.user_id, []);
      map.get(row.user_id)!.push(row);
    });
    return map;
  }, [progressRows]);

  const userSummaries = useMemo(() => {
    return clinicUsers.map((user) => {
      const rows = progressByUser.get(user.user_id || '') || [];
      const completedIds = new Set<string>();
      const startedIds = new Set<string>();
      let lastActivity: string | null = null;
      rows.forEach((row) => {
        const percent = Number(row.watched_percent || 0);
        if (percent > 0 || (row.watched_seconds || 0) > 0) {
          startedIds.add(row.lesson_id);
        }
        if (row.completed_at || percent >= 90) {
          completedIds.add(row.lesson_id);
        }
        if (row.last_watched_at) {
          if (!lastActivity || new Date(row.last_watched_at) > new Date(lastActivity)) {
            lastActivity = row.last_watched_at;
          }
        }
      });

      const completedCount = completedIds.size;
      const startedCount = startedIds.size;
      const percent = requiredCount ? Math.round((completedCount / requiredCount) * 100) : 0;
      const status =
        requiredCount === 0
          ? 'Sem aulas'
          : completedCount === requiredCount
            ? 'Pronto'
            : startedCount > 0
              ? 'Parcial'
              : 'Não iniciado';
      const missing = requiredLessons
        .filter((lesson) => !completedIds.has(lesson.id))
        .slice(0, 3)
        .map((lesson) => lesson.title || 'Aula');
      return {
        user,
        completedCount,
        percent,
        status,
        lastActivity,
        missing,
      };
    });
  }, [clinicUsers, progressByUser, requiredCount, requiredLessons]);

  const clinicSummary = useMemo(() => {
    if (!userSummaries.length || requiredCount === 0) {
      return { avg: 0, readyCount: 0 };
    }
    const avg =
      userSummaries.reduce((sum, entry) => sum + entry.percent, 0) / Math.max(1, userSummaries.length);
    const readyCount = userSummaries.filter((entry) => entry.status === 'Pronto').length;
    return { avg: Math.round(avg), readyCount };
  }, [userSummaries, requiredCount]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Briefing de Conteúdos</h1>
        <p className="text-gray-500">Acompanhe rapidamente se a clínica assistiu as aulas necessárias para a reunião.</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm text-gray-600">Clínica</label>
            <select
              value={selectedClinicId}
              onChange={(e) => setSelectedClinicId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600">Tag da reunião</label>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="all">Todas</option>
              {meetingTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col justify-end text-sm text-gray-500">
            <span>Aulas obrigatórias: <strong className="text-gray-700">{requiredCount}</strong></span>
            <span>Média concluída: <strong className="text-gray-700">{clinicSummary.avg}%</strong></span>
            <span>Prontos: <strong className="text-gray-700">{clinicSummary.readyCount}</strong></span>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_2fr] gap-6">
        <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Aulas obrigatórias</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Carregando aulas...</p>
          ) : requiredLessons.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma aula obrigatória cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {requiredLessons.map((lesson) => (
                <div key={lesson.id} className="border border-gray-100 rounded-lg p-3 text-sm text-gray-600">
                  <div className="font-semibold text-gray-800">{lesson.title || 'Aula'}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {lesson.content_modules?.content_items?.title || 'Conteúdo'} • {lesson.content_modules?.title || 'Módulo'}
                  </div>
                  {lesson.meeting_tag && (
                    <span className="inline-flex mt-2 text-[10px] uppercase tracking-wide bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {lesson.meeting_tag}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Resumo por usuário</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Carregando usuários...</p>
          ) : userSummaries.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum usuário com acesso na clínica.</p>
          ) : (
            <div className="space-y-3">
              {userSummaries.map((entry) => (
                <div key={entry.user.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{entry.user.name}</div>
                      <div className="text-xs text-gray-500">{entry.user.email}</div>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        entry.status === 'Pronto'
                          ? 'bg-emerald-50 text-emerald-700'
                          : entry.status === 'Parcial'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {entry.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-500">
                    <span>Concluídas: <strong className="text-gray-700">{entry.completedCount}</strong> / {requiredCount}</span>
                    <span>Progresso: <strong className="text-gray-700">{entry.percent}%</strong></span>
                    <span>Última atividade: <strong className="text-gray-700">{formatDateTime(entry.lastActivity)}</strong></span>
                  </div>
                  {entry.missing.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      Faltando: <span className="text-gray-700">{entry.missing.join(', ')}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedClinicId && requiredCount > 0 && (
        <div className="text-xs text-gray-400">
          Observação: aulas são consideradas concluídas quando o progresso atinge 90% ou mais.
        </div>
      )}
    </div>
  );
};

export default AdminContentBriefing;
