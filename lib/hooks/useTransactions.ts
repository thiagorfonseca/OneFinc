import { useEffect, useState } from 'react';
import { api } from '../api';

export const useBankAccounts = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const fetch = async () => {
    setLoading(true);
    try {
      const data = await api.fetchBankAccounts();
      setAccounts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetch(); }, []);
  return { accounts, loading, refresh: fetch };
};

export const useBankTransactions = (accountId?: string) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = async (acc?: string) => {
    const id = acc || accountId;
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.fetchBankTransactions(id);
      setTransactions(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (accountId) fetch(accountId); }, [accountId]);

  return { transactions, loading, refresh: fetch, setTransactions };
};
