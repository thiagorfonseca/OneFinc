import { useEffect, useState } from 'react';
import { api } from '../api';

export const useProcedures = () => {
  const [procedures, setProcedures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await api.fetchProcedures();
      setProcedures(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  return { procedures, loading, refresh: fetch, setProcedures };
};
