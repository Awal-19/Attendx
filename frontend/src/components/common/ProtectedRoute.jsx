import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const getRoleHomePath = (role) => {
  if (role === 'LECTURER') return '/lecturer/dashboard';
  if (role === 'ADMIN' || role === 'DEPT_ADMIN') return '/admin/dashboard';
  return '/student/dashboard';
};

export const getRoleLoginPath = (role) => {
  if (role === 'LECTURER') return '/lecturer';
  if (role === 'ADMIN' || role === 'DEPT_ADMIN') return '/admin';
  return '/login';
};

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-600">Verifying AttendX session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const targetLogin = allowedRoles.includes('LECTURER')
      ? '/lecturer'
      : allowedRoles.includes('ADMIN')
        ? '/admin'
        : '/login';
    return <Navigate to={targetLogin} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  return children;
};

export default ProtectedRoute;

