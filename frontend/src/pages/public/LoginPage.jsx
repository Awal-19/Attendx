import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getRoleHomePath } from '../../components/common/ProtectedRoute';

const LoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const path = location.pathname.toLowerCase();
  const isLecturerRoute = path.includes('lecturer');
  const isStudentRoute = path.includes('student');

  const portalHeading = isLecturerRoute
    ? { prefix: 'Lecturer', highlight: 'Portal' }
    : isStudentRoute
      ? { prefix: 'Student', highlight: 'Portal' }
      : { prefix: 'University', highlight: 'Portal' };

  const portalSubtitle = isLecturerRoute
    ? 'Sign in to access your lecturer dashboard.'
    : isStudentRoute
      ? 'Sign in with your UCC student email or Index Number.'
      : 'Sign in as a Student, Lecturer, or Administrator.';

  const identifierLabel = isLecturerRoute
    ? 'Institutional Email Address'
    : 'Email or Student Index Number';

  const identifierPlaceholder = isLecturerRoute
    ? 'lecturer@ucc.edu.gh'
    : 'PS/CSC/24/0044 or student@stu.ucc.edu.gh';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      addToast('Please enter your institutional email / ID and password.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const loggedInUser = await login(identifier.trim(), password);
      addToast(`Welcome back, ${loggedInUser.full_name}!`, 'success', 'Authentication Verified');
      navigate(getRoleHomePath(loggedInUser.role));
    } catch (err) {
      const msg =
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'Invalid credentials. Please check your institutional email and password.';
      addToast(msg, 'error', 'Sign In Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8 overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* Embedded Apple Liquid Glass Styles & Micro-Animations */}
      <style>{`
        @keyframes lecturerCardFadeIn {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes lecturerAmbientFloat {
          0%, 100% {
            opacity: 0.55;
            transform: scale(1);
          }
          50% {
            opacity: 0.82;
            transform: scale(1.06);
          }
        }
        .ucc-lecturer-glass-card {
          animation: lecturerCardFadeIn 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          background: linear-gradient(
            145deg,
            rgba(255, 255, 255, 0.14) 0%,
            rgba(15, 34, 78, 0.36) 46%,
            rgba(7, 17, 42, 0.44) 84%,
            rgba(185, 28, 28, 0.13) 100%
          );
          backdrop-filter: blur(25px) saturate(175%);
          -webkit-backdrop-filter: blur(25px) saturate(175%);
          border: 1px solid rgba(255, 255, 255, 0.25);
          box-shadow:
            0 32px 72px -16px rgba(2, 6, 23, 0.72),
            0 0 40px -10px rgba(37, 99, 235, 0.3),
            0 0 28px -12px rgba(220, 38, 38, 0.2),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.36),
            inset 0 -1px 0 0 rgba(255, 255, 255, 0.08);
        }
        .ucc-lecturer-input {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.09) 0%,
            rgba(6, 16, 40, 0.44) 100%
          );
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.22);
          box-shadow:
            inset 0 1px 0 0 rgba(255, 255, 255, 0.12),
            0 4px 14px -4px rgba(2, 6, 23, 0.35);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ucc-lecturer-input:hover {
          border-color: rgba(255, 255, 255, 0.34);
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.13) 0%,
            rgba(10, 24, 58, 0.5) 100%
          );
        }
        .ucc-lecturer-input:focus {
          outline: none;
          border-color: rgba(96, 165, 250, 0.78);
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.15) 0%,
            rgba(12, 28, 68, 0.56) 100%
          );
          box-shadow:
            0 0 0 3px rgba(37, 99, 235, 0.28),
            0 0 18px -2px rgba(220, 38, 38, 0.22),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.24);
        }
        .ucc-lecturer-btn-primary {
          background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 38%, #2563eb 68%, #b91c1c 92%, #dc2626 100%);
          border: 1px solid rgba(255, 255, 255, 0.32);
          box-shadow:
            0 16px 36px -8px rgba(37, 99, 235, 0.58),
            0 8px 24px -6px rgba(220, 38, 38, 0.38),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.4);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ucc-lecturer-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 42%, #3b82f6 68%, #dc2626 92%, #ef4444 100%);
          box-shadow:
            0 20px 44px -8px rgba(37, 99, 235, 0.72),
            0 12px 28px -6px rgba(220, 38, 38, 0.52),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.52);
        }
        .ucc-lecturer-btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }
      `}</style>

      {/* Authentic Full-Screen UCC Entrance Photograph & Ambient Lighting */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="/images/ucc-authentic-entrance.jpg"
          alt="University of Cape Coast Main Entrance"
          className="w-full h-full object-cover object-center scale-[1.01]"
        />
        {/* Balanced Dark Navy Overlay Keeping the UCC Entrance Recognizable */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, rgba(4, 13, 33, 0.62) 0%, rgba(7, 20, 48, 0.44) 50%, rgba(4, 13, 33, 0.68) 100%)',
          }}
        />
        {/* Royal Blue Ambient Lighting (Top-Left) */}
        <div
          className="absolute -top-24 -left-24 w-[32rem] h-[32rem] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.32) 0%, transparent 70%)',
            filter: 'blur(55px)',
            animation: 'lecturerAmbientFloat 9s ease-in-out infinite',
          }}
        />
        {/* Subtle UCC Crimson Red Ambient Glow (Bottom-Right) */}
        <div
          className="absolute -bottom-24 -right-20 w-[30rem] h-[30rem] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(220, 38, 38, 0.24) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'lecturerAmbientFloat 11s ease-in-out infinite reverse',
          }}
        />
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="group inline-flex items-center gap-3 px-4 py-2 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
          style={{
            background: 'rgba(10, 24, 56, 0.42)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.22)',
            boxShadow:
              '0 12px 28px -8px rgba(2, 6, 23, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.28)',
          }}
        >
          <div className="w-9 h-9 rounded-xl bg-white/95 p-1 flex items-center justify-center shadow-sm border border-white/60">
            <img
              src="/images/ucc-official-crest.png"
              alt="University of Cape Coast Crest"
              className="w-full h-full object-contain"
            />
          </div>
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{
              background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
              border: '1px solid rgba(255, 255, 255, 0.35)',
            }}
          >
            <QrCode className="w-4 h-4 text-white" />
          </div>
          <div className="text-left pr-1">
            <span className="block font-extrabold text-lg tracking-tight text-white leading-none">
              AttendX <span className="text-red-400">•</span>{' '}
              <span className="text-blue-200">UCC</span>
            </span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-blue-200/85 mt-0.5">
              University of Cape Coast
            </span>
          </div>
        </Link>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white/90 hover:text-white transition-all"
          style={{
            background: 'rgba(10, 24, 56, 0.38)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5 text-blue-300" />
          <span>Back to AttendX Home</span>
        </Link>
      </header>

      {/* Main Centered Liquid Glass Lecturer Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center my-6">
        <div className="w-full max-w-[450px]">
          <div className="ucc-lecturer-glass-card relative rounded-3xl p-7 sm:p-9 overflow-hidden">
            {/* Top Multi-Color Specular Rim Highlight (Blue -> White -> Crimson Red) */}
            <div
              className="absolute top-0 inset-x-0 h-[2px]"
              style={{
                background:
                  'linear-gradient(90deg, transparent 5%, rgba(59, 130, 246, 0.85) 28%, rgba(255, 255, 255, 0.95) 50%, rgba(239, 68, 68, 0.85) 72%, transparent 95%)',
              }}
            />

            {/* Subtle Inner Corner Glass Reflections */}
            <div
              className="absolute -top-20 -left-20 w-48 h-48 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, transparent 70%)',
                filter: 'blur(24px)',
              }}
            />
            <div
              className="absolute -bottom-20 -right-20 w-48 h-48 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(220, 38, 38, 0.18) 0%, transparent 70%)',
                filter: 'blur(24px)',
              }}
            />

            {/* Card Header: Official UCC Crest + AttendX • UCC + Lecturer Portal */}
            <div className="relative z-10 text-center mb-7">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl mb-4"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(15, 34, 78, 0.38) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.24)',
                  boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.28)',
                }}
              >
                <img
                  src="/images/ucc-official-crest.png"
                  alt="Official University of Cape Coast Crest"
                  className="w-6 h-7 object-contain drop-shadow"
                />
                <span className="text-xs font-extrabold tracking-wider uppercase text-white">
                  AttendX <span className="text-red-400">•</span>{' '}
                  <span className="text-blue-200">UCC</span>
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(2,6,23,0.55)]">
                {portalHeading.prefix}{' '}
                <span
                  style={{
                    background: 'linear-gradient(90deg, #ffffff 0%, #93c5fd 55%, #f87171 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {portalHeading.highlight}
                </span>
              </h1>

              <p className="mt-1.5 text-xs sm:text-sm text-blue-100/90 font-medium">
                {portalSubtitle}
              </p>

              {/* Quick Portal Switcher */}
              <div className="mt-4 inline-flex items-center gap-1 p-1 rounded-xl bg-white/10 border border-white/15 text-[11px] font-bold">
                <Link
                  to="/login/student"
                  className={`px-3 py-1.5 rounded-lg transition ${
                    isStudentRoute
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-blue-100/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  Student Login
                </Link>
                <Link
                  to="/login/lecturer"
                  className={`px-3 py-1.5 rounded-lg transition ${
                    isLecturerRoute
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-blue-100/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  Lecturer Login
                </Link>
              </div>
            </div>

            {/* Authentication Form */}
            <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
              {/* Institutional Email or Student Index Number */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>{identifierLabel}</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-blue-200/85 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={identifierPlaceholder}
                    className="ucc-lecturer-input w-full h-12 pl-10 pr-4 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span>Password</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-blue-200/85 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="ucc-lecturer-input w-full h-12 pl-10 pr-11 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium"
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

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="inline-flex items-center gap-2 text-blue-100/95 font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-blue-300 hover:text-white font-semibold underline decoration-blue-400/50 underline-offset-4 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Premium Blue-to-Red Gradient Sign-In Button */}
              <div className="pt-1.5">
                <button
                  type="submit"
                  disabled={submitting}
                  className="ucc-lecturer-btn-primary w-full h-12 rounded-xl text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 disabled:opacity-65 cursor-pointer"
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

            {/* Bottom Registration & Portal Links */}
            <div className="relative z-10 mt-6 pt-5 border-t border-white/15 space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
                <Link
                  to="/register/lecturer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-white/95 hover:text-white font-semibold transition-all"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(29, 78, 216, 0.26) 0%, rgba(220, 38, 38, 0.22) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <span>New Lecturer?</span>
                  <span className="text-red-300 font-bold">Register here →</span>
                </Link>

                <Link
                  to="/register/student"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-blue-100/90 hover:text-white font-semibold transition-all"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                  }}
                >
                  <span>Student Registration →</span>
                </Link>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-blue-200/75 font-medium pt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
                <span>AttendX • University of Cape Coast</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Subtle Bottom Footer Caption */}
      <footer className="relative z-10 text-center text-[11px] font-medium text-blue-100/75 tracking-wide drop-shadow">
        AttendX • University of Cape Coast Smart Attendance &amp; Academic Verification Platform
      </footer>
    </div>
  );
};

export default LoginPage;
