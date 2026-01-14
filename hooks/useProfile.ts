import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { OrgProfile, UserRole } from '../types';

export function useProfile() {
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, clinic_id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) throw error;

      // Busca role e ativação em clinic_users (membership)
      const { data: membership } = await supabase
        .from('clinic_users')
        .select('id, clinic_id, role, ativo, user_id, email')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const merged: OrgProfile = {
        id: data?.id || session.user.id,
        user_id: session.user.id,
        full_name: data?.full_name || session.user.user_metadata?.full_name || session.user.email || '',
        email: membership?.email || session.user.email,
        role: (membership?.role as UserRole) || (data?.role as UserRole) || 'user',
        clinic_id: data?.clinic_id || membership?.clinic_id || null,
        ativo: membership?.ativo ?? true,
      };

      setProfile(merged);
    } catch (err: any) {
      setError(err.message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile };
}
