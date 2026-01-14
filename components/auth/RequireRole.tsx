import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../src/auth/AuthProvider';

type Allowed = Array<'owner' | 'admin' | 'user'>;

interface Props {
  allow: Allowed;
  children: React.ReactNode;
}

export const RequireRole: React.FC<Props> = ({ allow, children }) => {
  const { role, loading, session } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-500">Carregando...</div>;
  if (!session) return <Navigate to="/login" replace />;

  if (!allow.includes(role || 'user')) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
};
