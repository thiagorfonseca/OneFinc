import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TransactionsPage from './pages/Transactions';
import Reconciliation from './pages/Reconciliation';
import Login from './pages/Login';
import BankAccounts from './pages/BankAccounts';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import CardAnalysis from './pages/CardAnalysis';
import { TransactionType } from './types';
import { supabase } from './lib/supabase';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;

  return session ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/incomes" element={
          <ProtectedRoute>
            <TransactionsPage type={TransactionType.INCOME} />
          </ProtectedRoute>
        } />
        
        <Route path="/expenses" element={
          <ProtectedRoute>
            <TransactionsPage type={TransactionType.EXPENSE} />
          </ProtectedRoute>
        } />

        <Route path="/reconciliation" element={
          <ProtectedRoute>
            <Reconciliation />
          </ProtectedRoute>
        } />

        <Route path="/accounts" element={
          <ProtectedRoute>
            <BankAccounts />
          </ProtectedRoute>
        } />

        <Route path="/settings" element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } />

        <Route path="/card-analysis" element={
          <ProtectedRoute>
            <CardAnalysis />
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
