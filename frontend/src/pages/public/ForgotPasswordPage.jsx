import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  KeyRound,
  ArrowRight,
  CheckCircle2,
  Mail,
  Smartphone,
  Eye,
  EyeOff,
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import UccAdminBackground from '../../components/auth/UccAdminBackground';
import '../../styles/uccLiquidGlass.css';

const ForgotPasswordPage = () => {
  const [mode, setMode] = useState('email'); // email | sms
  const [identifier, setIdentifier] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [smsStep, setSmsStep] = useState(1);
  const [smsCode, setSmsCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
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

  const handleEmailRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password/', { identifier: identifier.trim() });
      setEmailSent(true);
    } catch (err) {
      addToast(err.response?.data?.error || 'Too many requests. Try again later.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSmsRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password/sms/', { identifier: identifier.trim() });
      setSmsStep(2);
      addToast('If a registered phone number exists, a 6-digit code was sent.', 'info');
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not send SMS code.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSmsConfirm = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addToast('Passwords do not match.', 'error');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password/sms/', {
        identifier: identifier.trim(),
        code: smsCode.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      addToast('Password updated! Please sign in.', 'success');
      navigate(returnLoginPath);
    } catch (err) {
      addToast(err.response?.data?.error || 'Invalid or expired SMS code.', 'error');
    } finally {
      setLoading(false);
    }
  };

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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold uppercase tracking-wider text-amber-200">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Password Recovery</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white">Forgot Password</h1>
            <p className="text-xs sm:text-sm text-blue-100/85">
              Enter your UCC Index Number or institutional email.
            </p>
          </div>

          {!emailSent && (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/10 border border-white/15">
              <button
                type="button"
                onClick={() => {
                  setMode('email');
                  setSmsStep(1);
                }}
                className={`min-h-[44px] rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition ${
                  mode === 'email' ? 'bg-blue-600 text-white shadow' : 'text-blue-100 hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email Link</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('sms')}
                className={`min-h-[44px] rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition ${
                  mode === 'sms' ? 'bg-blue-600 text-white shadow' : 'text-blue-100 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>SMS Backup</span>
              </button>
            </div>
          )}

          {emailSent ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-emerald-500/20 border border-emerald-400/40">
                <CheckCircle2 className="w-7 h-7 text-emerald-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">Check your email</h2>
              <p className="text-sm text-blue-100/90">
                If an account exists, we&apos;ve sent a reset link to the email on file.
              </p>
              <p className="text-xs text-blue-200/75">
                The link expires in 30 minutes. No working email? Use the SMS Backup tab or visit
                your department admin office.
              </p>
              <button
                type="button"
                onClick={() => setEmailSent(false)}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
              >
                Try another index number or SMS
              </button>
            </div>
          ) : mode === 'email' ? (
            <form onSubmit={handleEmailRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-blue-100 mb-1.5">
                  Index Number or Email
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. PS/CSC/24/0044 or email@stu.ucc.edu.gh"
                  className="ucc-glass-input w-full min-h-[48px] px-4 py-3 rounded-xl text-sm text-white"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="ucc-submit-btn w-full min-h-[48px] py-3 px-4 rounded-xl text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{loading ? 'Sending...' : 'Send Reset Link'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : smsStep === 1 ? (
            <form onSubmit={handleSmsRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-blue-100 mb-1.5">
                  Index Number
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. PS/CSC/24/0044"
                  className="ucc-glass-input w-full min-h-[48px] px-4 py-3 rounded-xl text-sm text-white"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="ucc-submit-btn w-full min-h-[48px] py-3 px-4 rounded-xl text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{loading ? 'Sending SMS...' : 'Send 6-Digit SMS Code'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleSmsConfirm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-blue-100 mb-1.5">
                  6-Digit SMS Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value)}
                  placeholder="123456"
                  className="ucc-glass-input w-full min-h-[48px] px-4 py-3 rounded-xl text-sm font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-blue-100 mb-1.5">
                  New Password (8+ chars, 10 recommended)
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="ucc-glass-input w-full min-h-[48px] px-4 py-3 pr-11 rounded-xl text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-3 text-blue-200 hover:text-white cursor-pointer"
                  >
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
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
                  className="ucc-glass-input w-full min-h-[48px] px-4 py-3 rounded-xl text-sm text-white"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="ucc-submit-btn w-full min-h-[48px] py-3 px-4 rounded-xl text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{loading ? 'Updating...' : 'Reset Password'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-white/15 text-center">
            <Link to={returnLoginPath} className="text-xs text-amber-300 hover:text-white font-bold">
              ← Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
