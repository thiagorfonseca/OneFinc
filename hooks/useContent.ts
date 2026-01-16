import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type ContentItem = {
  id: string;
  type: 'course' | 'training';
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  banner_url: string | null;
  published: boolean | null;
  created_at: string | null;
};

type ContentModule = {
  id: string;
  content_id: string | null;
  title: string | null;
  order_index: number | null;
  thumbnail_url: string | null;
};

type ContentLesson = {
  id: string;
  module_id: string | null;
  title: string | null;
  description: string | null;
  panda_video_id: string | null;
  panda_video_url: string | null;
  order_index: number | null;
  published: boolean | null;
};

type ContentLessonFile = {
  id: string;
  lesson_id: string | null;
  file_name: string | null;
  file_url: string | null;
  created_at: string | null;
};

type ContentComment = {
  id: string;
  content_id: string | null;
  module_id: string | null;
  lesson_id: string | null;
  student_user_id: string | null;
  content: string | null;
  status: string | null;
  created_at: string | null;
};

const useQueryState = <T,>(initial: T) => {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return { data, setData, loading, setLoading, error, setError };
};

export const useContentItem = (id?: string | null) => {
  const state = useQueryState<ContentItem | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      state.setData(null);
      state.setLoading(false);
      return;
    }
    state.setLoading(true);
    const { data, error } = await supabase
      .from('content_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) state.setError(error.message);
    state.setData((data as ContentItem) || null);
    state.setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
};

export const useModules = (contentId?: string | null) => {
  const state = useQueryState<ContentModule[]>([]);

  const load = useCallback(async () => {
    if (!contentId) {
      state.setData([]);
      state.setLoading(false);
      return;
    }
    state.setLoading(true);
    const { data, error } = await supabase
      .from('content_modules')
      .select('*')
      .eq('content_id', contentId)
      .order('order_index', { ascending: true });
    if (error) state.setError(error.message);
    state.setData((data || []) as ContentModule[]);
    state.setLoading(false);
  }, [contentId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
};

export const useLessons = (moduleId?: string | null) => {
  const state = useQueryState<ContentLesson[]>([]);

  const load = useCallback(async () => {
    if (!moduleId) {
      state.setData([]);
      state.setLoading(false);
      return;
    }
    state.setLoading(true);
    const { data, error } = await supabase
      .from('content_lessons')
      .select('*')
      .eq('module_id', moduleId)
      .order('order_index', { ascending: true });
    if (error) state.setError(error.message);
    state.setData((data || []) as ContentLesson[]);
    state.setLoading(false);
  }, [moduleId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
};

export const useLessonFiles = (lessonId?: string | null) => {
  const state = useQueryState<ContentLessonFile[]>([]);

  const load = useCallback(async () => {
    if (!lessonId) {
      state.setData([]);
      state.setLoading(false);
      return;
    }
    state.setLoading(true);
    const { data, error } = await supabase
      .from('content_lesson_files')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false });
    if (error) state.setError(error.message);
    state.setData((data || []) as ContentLessonFile[]);
    state.setLoading(false);
  }, [lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
};

export const useComments = (filters: {
  contentId?: string | null;
  moduleId?: string | null;
  lessonId?: string | null;
  studentUserId?: string | null;
}) => {
  const { contentId, moduleId, lessonId, studentUserId } = filters;
  const state = useQueryState<ContentComment[]>([]);

  const queryKey = useMemo(() => JSON.stringify(filters), [filters]);

  const load = useCallback(async () => {
    if (!contentId) {
      state.setData([]);
      state.setLoading(false);
      return;
    }
    state.setLoading(true);
    let query = supabase
      .from('content_comments')
      .select('*')
      .eq('content_id', contentId)
      .order('created_at', { ascending: false });
    if (moduleId) query = query.eq('module_id', moduleId);
    if (lessonId) query = query.eq('lesson_id', lessonId);
    if (studentUserId) query = query.eq('student_user_id', studentUserId);
    const { data, error } = await query;
    if (error) state.setError(error.message);
    state.setData((data || []) as ContentComment[]);
    state.setLoading(false);
  }, [contentId, moduleId, lessonId, studentUserId]);

  useEffect(() => {
    load();
  }, [load, queryKey]);

  return { ...state, refresh: load };
};
