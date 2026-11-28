import React, { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { QrCode, KeyRound, ArrowRight, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const roleParam = (searchParams.get('role') || '').toLowerCase();
  const pathLower = location.pathname.toLowerCase();
  const returnLoginPath =
    roleParam === 'lecturer' || pathLower.startsWith('/lecturer')
      ? '/lecturer'
      : roleParam === 'admin' || pathLower.startsWith('/admin')
        ? '/admin'
        : '/login';

  const handleLookup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password/', { email });
      setStep(2);
      addToast('If an account exists for that email, a 6-digit reset code has been sent.', 'info');
    } catch (err) {
      addToast(
        err.response?.data?.error || 'Could not process password reset request.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password/', {
        email,
        reset_code: verificationId,
        new_password: newPassword,
      });
      addToast('Password reset successful! You can now sign in.', 'success');
      navigate(returnLoginPath);
    } catch (err) {
      addToast(
        err.response?.data?.error || 'Verification failed. Check your 6-digit reset code.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-2xl text-white">AttendX Recovery</span>
        </Link>
        <h2 className="mt-5 text-2xl font-bold text-white flex items-center justify-center gap-2">
          <KeyRound className="w-5 h-5 text-indigo-400" />
          <span>University Password Recovery</span>
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Verify your institutional email and Index Number / Staff ID
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/90 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-8">
          {step === 1 ? (
            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Registered University Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. kofi.asante@stu.ucc.edu.gh"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition cursor-pointer"
              >
                <span>{loading ? 'Locating Account...' : 'Continue to Identity Check'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-700/40 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Reset code sent to {email} (if registered)</span>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  6-Digit Reset Code
                </label>
                <input
                  type="text"
                  required
                  value={verificationId}
                  onChange={(e) => setVerificationId(e.target.value.trim())}
                  placeholder="Enter 6-digit code from your email"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  New Password (Min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition cursor-pointer"
              >
                <span>{loading ? 'Updating Password...' : 'Verify & Reset Password'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <Link to={returnLoginPath} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
              ← Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

