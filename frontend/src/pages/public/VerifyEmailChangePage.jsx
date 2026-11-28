import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import UccAdminBackground from '../../components/auth/UccAdminBackground';
import '../../styles/uccLiquidGlass.css';

const VerifyEmailChangePage = () => {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') || '').trim();
  const [statusState, setStatusState] = useState('loading');
  const [msg, setMsg] = useState('Confirming your new email address...');

  useEffect(() => {
    if (!token) {
      setStatusState('error');
      setMsg('Verification token is missing.');
      return;
    }
    api
      .post('/auth/profile/email-change/confirm/', { token })
      .then((res) => {
        setStatusState('success');
        setMsg(res.data?.message || 'Your email address has been updated.');
      })
      .catch((err) => {
        setStatusState('error');
        setMsg(err.response?.data?.error || 'This link is invalid or has expired.');
      });
  }, [token]);

  return (
    <div className="ucc-theme-root min-h-[100dvh] w-full flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <UccAdminBackground />
      <div className="relative z-10 w-full max-w-md ucc-liquid-glass rounded-3xl p-6 sm:p-8 text-center space-y-4">
        {statusState === 'loading' && (
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
        )}
        {statusState === 'success' && <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />}
        {statusState === 'error' && <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />}
        <h1 className="text-xl font-extrabold text-white">Email Confirmation</h1>
        <p className="text-sm text-blue-100">{msg}</p>
        <Link
          to="/login"
          className="ucc-submit-btn w-full min-h-[48px] py-3 px-4 rounded-xl text-white font-bold text-sm inline-flex items-center justify-center"
        >
          Return to AttendX
        </Link>
      </div>
    </div>
  );
};

export default VerifyEmailChangePage;

