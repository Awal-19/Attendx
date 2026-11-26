import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  QrCode,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getRoleHomePath } from '../common/ProtectedRoute';

const RoleLoginShell = ({
  roleKey,
  expectedRoles,
  badgeText,
  headingPrefix,
  headingHighlight,
  subtitle,
  identifierLabel,
  identifierPlaceholder,
  icon: RoleIcon,
  accentGradient,
  badgeStyle,
  focusRingColor,
  buttonGradient,
  registerLink,
  forgotPasswordPath,
  pageTitle,
  noindex = false,
  customRootClass = '',
  customThemeCss = '',
  backgroundNode = null,
  footerLogoSrc = '',
  footerLogoAlt = 'University of Cape Coast crest',
  cardClassName = '',
  inputClassName = '',
  forgotLinkClassName = '',
  checkboxClassName = '',
  registerButtonClassName = '',
  submitButtonClassName = '',
  headerClassName = '',
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { user, login, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const prevTitle = document.title;
    if (pageTitle) document.title = pageTitle;

    let meta = null;
    if (noindex) {
      meta = document.querySelector('meta[name="robots"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'robots');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', 'noindex, nofollow');
    }

    return () => {
      document.title = prevTitle;
      if (noindex && meta) {
        meta.remove();
      }
    };
  }, [pageTitle, noindex]);

  const isSameRole = user && expectedRoles.includes(user.role);
  const isDifferentRole = user && !expectedRoles.includes(user.role);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      addToast('Please enter your credentials and password.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const loggedInUser = await login(identifier.trim(), password, roleKey);
      addToast(`Welcome back, ${loggedInUser.full_name}!`, 'success', 'Authentication Verified');
      navigate(getRoleHomePath(loggedInUser.role), { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'Invalid credentials.';
      addToast(msg, 'error', 'Sign In Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchAccount = async () => {
    await logout();
    addToast('Signed out of previous session. You can sign in below.', 'info');
  };

  return (
    <div className={`relative min-h-screen w-full flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8 overflow-x-hidden bg-[#061430] selection:bg-blue-600 selection:text-white ${customRootClass}`}>
      {backgroundNode}
      <style>{`
        .ucc-role-glass-card {
          background: linear-gradient(145deg, rgba(255,255,255,0.13) 0%, rgba(15,34,78,0.42) 48%, rgba(7,17,42,0.58) 100%);
          backdrop-filter: blur(24px) saturate(170%);
          -webkit-backdrop-filter: blur(24px) saturate(170%);
          border: 1px solid rgba(255,255,255,0.22);
          box-shadow: 0 32px 72px -16px rgba(2,6,23,0.75), inset 0 1px 0 rgba(255,255,255,0.3);
        }
        .ucc-role-input {
          background: linear-gradient(135deg, rgba(255,255,255,0.09) 0%, rgba(6,16,40,0.48) 100%);
          border: 1px solid rgba(255,255,255,0.2);
          transition: all 0.2s ease;
        }
        .ucc-role-input:focus {
          outline: none;
          border-color: ${focusRingColor};
          box-shadow: 0 0 0 3px ${focusRingColor}44;
        }
        ${customThemeCss}
      `}</style>

      {/* Top Navigation */}
      <header className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between">
        <Link
          to="/"
          className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#0a1838]/60 border border-white/20 backdrop-blur-md transition hover:scale-[1.02] ${headerClassName}`}
        >
          <div className="w-8 h-8 rounded-lg bg-white/95 p-1 flex items-center justify-center">
            <img src="/images/ucc-official-crest.png" alt="University of Cape Coast crest" className="w-full h-full object-contain" />
          </div>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: buttonGradient }}>
            <QrCode className="w-3.5 h-3.5" />
          </div>
          <div className="text-left leading-tight">
            <span className="block text-sm font-extrabold text-white">AttendX • UCC</span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-blue-200/80">
              University of Cape Coast
            </span>
          </div>
        </Link>

        <Link
          to="/"
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white/95 hover:text-white bg-[#0a1838]/55 border border-white/20 transition ${headerClassName}`}
        >
          <ArrowLeft className="w-3.5 h-3.5 text-amber-300" />
          <span>Home</span>
        </Link>
      </header>

      {/* Centered Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center my-6">
        <div className="w-full max-w-[445px]">
          <div className={`ucc-role-glass-card relative rounded-3xl p-7 sm:p-9 overflow-hidden ${cardClassName}`}>
            <div className="absolute top-0 inset-x-0 h-[3px]" style={{ background: accentGradient }} />

            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider mb-3" style={badgeStyle}>
                {RoleIcon && <RoleIcon className="w-3.5 h-3.5" />}
                <span>{badgeText}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {headingPrefix}{' '}
                <span style={{ background: accentGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {headingHighlight}
                </span>
              </h1>

              <p className="mt-1.5 text-xs sm:text-sm text-blue-100/90 font-medium">{subtitle}</p>
            </div>

            {isSameRole && (
              <div className="mb-5 p-4 rounded-2xl bg-white/10 border border-white/20 text-xs text-white space-y-3">
                <p className="font-semibold">
                  You are already signed in as <span className="font-bold">{user.full_name}</span>.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(getRoleHomePath(user.role))}
                    className="flex-1 py-2.5 rounded-xl font-bold text-white cursor-pointer"
                    style={{ background: buttonGradient }}
                  >
                    Go to Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 font-semibold cursor-pointer"
                  >
                    Log Out
                  </button>
                </div>
              </div>
            )}

            {isDifferentRole && (
              <div className="mb-5 p-4 rounded-2xl bg-amber-500/15 border border-amber-400/35 text-xs text-amber-100 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <p>
                    You are currently signed in as <span className="font-bold">{user.role}</span> ({user.email}). Log out before signing into this portal.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
                  >
                    Switch Account (Log Out)
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(getRoleHomePath(user.role))}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold cursor-pointer"
                  >
                    My Dashboard
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span>{identifierLabel}</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={identifierPlaceholder}
                    className={`ucc-role-input w-full h-12 pl-10 pr-4 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium ${inputClassName}`}
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span>Password</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`ucc-role-input w-full h-12 pl-10 pr-11 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium ${inputClassName}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200/75 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="inline-flex items-center gap-2 text-blue-100/95 font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className={`w-4 h-4 rounded accent-blue-600 cursor-pointer ${checkboxClassName}`}
                  />
                  <span>Remember me</span>
                </label>
                <Link
                  to={forgotPasswordPath}
                  className={`text-blue-300 hover:text-white font-semibold underline underline-offset-4 transition-colors ${forgotLinkClassName}`}
                >
                  Forgot password?
                </Link>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={submitting || isDifferentRole}
                  className={`w-full h-12 rounded-xl text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 disabled:opacity-55 cursor-pointer shadow-lg transition hover:brightness-110 ${submitButtonClassName}`}
                  style={{ background: buttonGradient }}
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 pt-5 border-t border-white/15 space-y-3">
              {registerLink && (
                <div className="text-center">
                  <Link
                    to={registerLink.to}
                    className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white/95 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20 transition ${registerButtonClassName}`}
                  >
                    <span>{registerLink.label}</span>
                  </Link>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-[11px] text-white/85 font-medium">
                {footerLogoSrc ? (
                  <img
                    src={footerLogoSrc}
                    alt={footerLogoAlt}
                    className="w-[22px] h-[22px] object-contain shrink-0 drop-shadow"
                  />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
                )}
                <span>AttendX • University of Cape Coast</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center text-[11px] font-medium text-blue-100/70">
        AttendX • University of Cape Coast Smart Attendance Platform
      </footer>
    </div>
  );
};

export default RoleLoginShell;

