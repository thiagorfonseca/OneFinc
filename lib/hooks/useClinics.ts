import { useEffect, useState } from 'react';
import { api } from '../api';

export const useClinics = () => {
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await api.fetchClinics();
      setClinics(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  return { clinics, loading, refresh: fetch, setClinics };
};
