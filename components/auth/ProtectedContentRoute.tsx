import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

interface Props {
  children: React.ReactNode;
}

const ProtectedContentRoute: React.FC<Props> = ({ children }) => {
  const { type } = useParams();
  let pageKey = '';
  if (type === 'courses') pageKey = '/contents/courses';
  if (type === 'trainings') pageKey = '/contents/trainings';

  if (!pageKey) {
    return <Navigate to="/access-denied" replace />;
  }

  return <ProtectedRoute page={pageKey}>{children}</ProtectedRoute>;
};

export default ProtectedContentRoute;
