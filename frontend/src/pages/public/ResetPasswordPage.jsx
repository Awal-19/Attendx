import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import UccAdminBackground from '../../components/auth/UccAdminBackground';
import '../../styles/uccLiquidGlass.css';

const getStrength = (pw) => {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 10) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 2) return { label: 'Weak', color: 'bg-red-500', pct: '33%' };
  if (score <= 4) return { label: 'Good', color: 'bg-amber-400', pct: '66%' };
  return { label: 'Strong', color: 'bg-emerald-400', pct: '100%' };
};

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') || '').trim();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [emailHint, setEmailHint] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setTokenError('No password reset token was provided.');
      return;
    }
    api
      .get(`/auth/reset-password/verify/?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setTokenValid(Boolean(res.data?.valid));
        setEmailHint(res.data?.email_hint || '');
      })
      .catch((err) => {
        setTokenValid(false);
        setTokenError(
          err.response?.data?.error || 'This password reset link is invalid or has expired.'
        );
      })
      .finally(() => setVerifying(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      addToast('Password must be at least 8 characters (10 recommended).', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('Passwords do not match.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password/', {
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setDone(true);
      addToast('Your password was changed. Please sign in.', 'success');
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not reset password.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const strength = getStrength(newPassword);

  return (
    <div className="ucc-theme-root min-h-[100dvh] w-full flex flex-col justify-center px-4 py-8 relative overflow-hidden">
      <UccAdminBackground />

      <div className="relative z-10 w-full max-w-md mx-auto">
        <div className="ucc-liquid-glass rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <img
              src="/images/ucc-official-crest.png"
              alt="UCC Crest"
              className="w-12 h-14 mx-auto object-contain"
            />
            <h1 className="text-2xl font-extrabold text-white">Set New Password</h1>
            {emailHint && (
              <p className="text-xs text-blue-100/80">Account: {emailHint}</p>
            )}
          </div>

          {verifying ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              <p className="text-sm text-blue-100">Verifying reset link...</p>
            </div>
          ) : done ? (
            <div className="py-4 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h2 className="text-lg font-extrabold text-white">Password Updated</h2>
              <p className="text-sm text-blue-100">
                All previous sessions have been signed out. Redirecting to login...
              </p>
              <Link
                to="/login"
                className="ucc-submit-btn w-full min-h-[48px] py-3 px-4 rounded-xl text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
              >
                <span>Go to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : !tokenValid ? (
            <div className="py-4 text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
              <h2 className="text-lg font-extrabold text-white">Link Expired or Invalid</h2>
              <p className="text-sm text-blue-100/90">{tokenError}</p>
              <Link
                to="/forgot-password"
                className="ucc-submit-btn w-full min-h-[48px] py-3 px-4 rounded-xl text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
              >
                <span>Request a new link</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-blue-100 mb-1.5">
                  New Password (8+ chars, 10 recommended)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-blue-200 absolute left-3.5 top-4" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter a strong password"
                    className="ucc-glass-input w-full min-h-[48px] pl-10 pr-11 py-3 rounded-xl text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-3 text-blue-200 hover:text-white cursor-pointer"
                  >
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
                      <div className={`h-full ${strength.color} transition-all`} style={{ width: strength.pct }} />
                    </div>
                    <p className="text-[11px] text-blue-100">Strength: {strength.label}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-blue-100 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="ucc-glass-input w-full min-h-[48px] px-4 py-3 rounded-xl text-sm text-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="ucc-submit-btn w-full min-h-[48px] py-3 px-4 rounded-xl text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{submitting ? 'Updating Password...' : 'Save New Password'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

