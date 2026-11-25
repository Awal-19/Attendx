import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode,
  ShieldCheck,
  Radio,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
  Building2,
  Smartphone,
  FileSpreadsheet,
  Clock,
  BookOpen,
  MapPin,
  Mail,
  Phone,
  Globe,
  Menu,
  X,
  ChevronRight,
  Camera,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRoleHomePath } from '../../components/common/ProtectedRoute';

const CAMPUS_BACKGROUNDS = [
  {
    id: 'entrance',
    image: '/images/ucc-authentic-entrance.jpg',
    label: 'University of Cape Coast Main Entrance',
    sublabel: 'University of Cape Coast • Main Campus Gateway',
  },
  {
    id: 'library',
    image: '/images/ucc-library-complex.jpg',
    label: 'Sam Jonah Library Complex',
    sublabel: 'University of Cape Coast • North Campus Academic Precinct',
  },
  {
    id: 'admin',
    image: '/images/ucc-admin-block.jpg',
    label: 'Central Administration Block',
    sublabel: 'University of Cape Coast • Main Institutional Headquarters',
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    title: 'Lecturer Generates QR Code',
    description:
      'The lecturer creates an attendance session and projects a unique QR code in the classroom.',
    detail:
      'Cryptographically signed with HMAC-SHA256 and configured with automatic time-to-live rotation.',
    icon: QrCode,
    accent: 'from-blue-500 to-blue-700',
  },
  {
    number: '02',
    title: 'Students Scan',
    description: 'Students scan the displayed QR code using their smartphones.',
    detail:
      'Works seamlessly through the built-in AttendX mobile camera scanner in any lecture theatre.',
    icon: Smartphone,
    accent: 'from-blue-600 via-indigo-600 to-red-600',
  },
  {
    number: '03',
    title: 'Attendance Recorded',
    description: 'The system verifies the student and records attendance instantly.',
    detail:
      'Course enrollment and student identity are validated in real time and streamed to the lecturer.',
    icon: CheckCircle2,
    accent: 'from-red-600 to-blue-700',
  },
];

const CORE_FEATURES = [
  {
    icon: QrCode,
    tag: 'CRYPTOGRAPHIC TOKENS',
    title: 'Dynamic QR Code Attendance',
    description:
      'Lecturers display time-sensitive, rotating QR codes on classroom projectors that automatically expire to prevent out-of-class sharing.',
  },
  {
    icon: Radio,
    tag: 'LIVE WEBSOCKET TELEMETRY',
    title: 'Real-Time Attendance Monitoring',
    description:
      'Watch student names, index numbers, and turnout percentages populate live on the lecturer console the exact second a student scans.',
  },
  {
    icon: ShieldCheck,
    tag: 'ANTI-PROXY PROTECTION',
    title: 'Secure Student Verification',
    description:
      'Strict JWT identity binding ensures students must be authenticated, enrolled in the course, and unable to submit another student’s index number.',
  },
  {
    icon: Clock,
    tag: 'POSTGRESQL INTEGRITY',
    title: 'Automatic Attendance Records',
    description:
      'Every scan is permanently timestamped and stored in PostgreSQL with database-level unique constraints and a complete audit trail.',
  },
  {
    icon: BarChart3,
    tag: 'ACADEMIC STANDING',
    title: 'Attendance Analytics',
    description:
      'Interactive visual analytics empower students, lecturers, and heads of department to track the 75% UCC examination eligibility threshold.',
  },
  {
    icon: FileSpreadsheet,
    tag: 'INSTITUTIONAL COMPLIANCE',
    title: 'PDF and Excel Reports',
    description:
      'Generate and download official University of Cape Coast formatted PDF and Excel (.xlsx) attendance registers with a single click.',
  },
];

const LandingPage = () => {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCampusIndex, setActiveCampusIndex] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 36);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const currentCampus = CAMPUS_BACKGROUNDS[activeCampusIndex];

  return (
    <div
      id="home"
      className="min-h-screen flex flex-col bg-[#040d21] text-white selection:bg-blue-600 selection:text-white"
    >
      {/* =====================================================================
          3. FLOATING APPLE LIQUID GLASS NAVIGATION BAR
      ===================================================================== */}
      <header className="fixed top-0 inset-x-0 z-50 px-3 sm:px-6 lg:px-8 pt-3 sm:pt-4 transition-all duration-300">
        <div
          className={`max-w-7xl mx-auto rounded-2xl transition-all duration-300 ${
            scrolled ? 'py-2.5 px-4 sm:px-6' : 'py-3.5 px-5 sm:px-7'
          }`}
          style={{
            background: scrolled
              ? 'linear-gradient(135deg, rgba(8, 22, 54, 0.78) 0%, rgba(12, 32, 76, 0.72) 65%, rgba(65, 14, 34, 0.68) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(15, 38, 88, 0.36) 55%, rgba(185, 28, 28, 0.18) 100%)',
            backdropFilter: 'blur(24px) saturate(185%)',
            WebkitBackdropFilter: 'blur(24px) saturate(185%)',
            border: '1px solid rgba(255, 255, 255, 0.28)',
            boxShadow: scrolled
              ? '0 20px 50px -12px rgba(2, 8, 24, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.35)'
              : '0 16px 40px -10px rgba(2, 8, 24, 0.45), inset 0 1px 1.5px rgba(255, 255, 255, 0.45)',
          }}
        >
          <div className="flex items-center justify-between">
            {/* Brand Logo + Official UCC Crest */}
            <a href="#home" className="flex items-center gap-3.5 group">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-105"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(37, 99, 235, 0.45) 0%, rgba(255, 255, 255, 0.15) 50%, rgba(220, 38, 38, 0.42) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.38)',
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.45)',
                }}
              >
                <img
                  src="/images/ucc-official-crest.png"
                  alt="UCC Crest"
                  className="w-7 h-8 object-contain drop-shadow"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-serif-display font-bold text-xl tracking-tight text-white">
                    AttendX
                  </span>
                  <span className="h-3.5 w-[1px] bg-white/30" />
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(29, 78, 216, 0.75) 0%, rgba(220, 38, 38, 0.75) 100%)',
                      border: '1px solid rgba(255, 255, 255, 0.32)',
                    }}
                  >
                    UCC
                  </span>
                </div>
                <span className="text-xs text-sky-100/90 font-medium tracking-wide">
                  University of Cape Coast
                </span>
              </div>
            </a>

            {/* Desktop Center Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1.5 text-sm font-medium text-white">
              {[
                { label: 'Home', href: '#home' },
                { label: 'About', href: '#about' },
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'Features', href: '#features' },
              ].map((nav) => (
                <a
                  key={nav.label}
                  href={nav.href}
                  className="px-4 py-2 rounded-xl text-white/90 hover:text-white hover:bg-white/12 transition-all duration-200"
                >
                  {nav.label}
                </a>
              ))}
            </nav>

            {/* Right Action Buttons */}
            <div className="hidden sm:flex items-center gap-3">
              {user ? (
                <Link
                  to={getRoleHomePath(user.role)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    background:
                      'linear-gradient(95deg, #1d4ed8 0%, #2563eb 55%, #dc2626 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.38)',
                  }}
                >
                  <span>Open {user.role} Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:bg-white/15 border border-transparent hover:border-white/25 transition-all"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register/student"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      background:
                        'linear-gradient(95deg, #1d4ed8 0%, #2563eb 58%, #dc2626 100%)',
                      border: '1px solid rgba(255, 255, 255, 0.42)',
                      boxShadow:
                        '0 10px 24px -6px rgba(37, 99, 235, 0.65), 0 6px 16px -6px rgba(220, 38, 38, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.45)',
                    }}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Student Portal</span>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-xl text-white bg-white/10 border border-white/20 hover:bg-white/20 transition"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Mobile Liquid Glass Drawer */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-3 pt-4 border-t border-white/20 space-y-3">
              <div className="flex flex-col space-y-1.5 text-sm font-medium text-white">
                <a
                  href="#home"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-xl hover:bg-white/10"
                >
                  Home
                </a>
                <a
                  href="#about"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-xl hover:bg-white/10"
                >
                  About
                </a>
                <a
                  href="#how-it-works"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-xl hover:bg-white/10"
                >
                  How It Works
                </a>
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-xl hover:bg-white/10"
                >
                  Features
                </a>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/12 border border-white/25 text-white text-center text-sm font-semibold"
                >
                  Sign In
                </Link>
                <Link
                  to="/register/student"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl text-white text-center text-sm font-bold"
                  style={{
                    background: 'linear-gradient(95deg, #1d4ed8 0%, #2563eb 55%, #dc2626 100%)',
                  }}
                >
                  Student Portal
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* =====================================================================
          4, 5 & 6. HERO SECTION WITH UCC ENTRANCE PHOTOGRAPH & LIQUID GLASS UI
      ===================================================================== */}
      <section className="relative min-h-screen w-full flex items-center overflow-hidden">
        {/* Authentic Full-Width Photograph of the University of Cape Coast Entrance */}
        <div className="absolute inset-0 z-0">
          <img
            src={currentCampus.image}
            alt={currentCampus.label}
            className="w-full h-full object-cover object-center scale-[1.01] transition-all duration-700"
          />
          {/* Balanced Dark Navy Overlay that keeps the UCC Entrance clearly recognizable */}
          <div className="absolute inset-0 bg-[#041026]/52" />
          {/* Left-to-right readability gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#040f25]/84 via-[#071a3e]/52 to-transparent" />
          {/* Subtle Royal Blue & UCC Crimson Red Ambient Lighting Reflections */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                radial-gradient(circle at 18% 32%, rgba(37, 99, 235, 0.28) 0%, transparent 48%),
                radial-gradient(circle at 82% 72%, rgba(220, 38, 38, 0.22) 0%, transparent 46%)
              `,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#040d21] via-transparent to-[#040f25]/45" />
        </div>

        {/* Hero Foreground Content */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-8 pt-32 pb-16 lg:py-36">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            {/* Left 8 Columns: Liquid Glass Hero Panel */}
            <div className="lg:col-span-8">
              <div
                className="rounded-3xl p-7 sm:p-10 lg:p-11 space-y-7 relative overflow-hidden"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(15, 38, 88, 0.28) 55%, rgba(220, 38, 38, 0.12) 100%)',
                  backdropFilter: 'blur(20px) saturate(175%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(175%)',
                  border: '1px solid rgba(255, 255, 255, 0.34)',
                  boxShadow:
                    '0 32px 72px -14px rgba(2, 8, 24, 0.65), inset 0 1.5px 2px rgba(255, 255, 255, 0.55), inset 0 -1px 2px rgba(239, 68, 68, 0.22)',
                }}
              >
                {/* Top Specular White-Blue-Red Reflection Line */}
                <div
                  className="absolute top-0 left-[8%] right-[8%] h-[1.5px] pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(147, 197, 253, 0.85) 25%, rgba(255, 255, 255, 0.98) 50%, rgba(252, 165, 165, 0.85) 75%, transparent 100%)',
                  }}
                />

                {/* Academic Year Liquid Glass Badge */}
                <div
                  className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase text-white"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(29, 78, 216, 0.45) 0%, rgba(255, 255, 255, 0.14) 50%, rgba(220, 38, 38, 0.42) 100%)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.38)',
                    boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.45)',
                  }}
                >
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <span>UNIVERSITY OF CAPE COAST | 2026/2027 ACADEMIC YEAR</span>
                </div>

                {/* Main Heading: Smarter Attendance. Better Learning. */}
                <h1 className="font-serif-display text-4xl sm:text-6xl lg:text-[66px] font-bold text-white tracking-tight leading-[1.07] drop-shadow-md">
                  Smarter Attendance.
                  <span
                    className="block mt-2 text-transparent bg-clip-text"
                    style={{
                      backgroundImage:
                        'linear-gradient(90deg, #ffffff 0%, #93c5fd 42%, #fca5a5 78%, #ef4444 100%)',
                    }}
                  >
                    Better Learning.
                  </span>
                </h1>

                {/* Supporting Description */}
                <p className="text-base sm:text-lg lg:text-xl text-white/95 leading-relaxed max-w-2xl font-normal drop-shadow-xs">
                  Welcome to AttendX, the smart university attendance management platform. Experience
                  seamless classroom attendance through secure QR code scanning, real-time
                  verification and intelligent attendance tracking.
                </p>

                {/* Primary & Secondary Liquid Glass Buttons */}
                <div className="pt-1 flex flex-wrap items-center gap-4">
                  {/* PRIMARY BUTTON: Blue-to-Red Gradient with Glass Highlights */}
                  <Link
                    to={user ? getRoleHomePath(user.role) : '/login'}
                    className="inline-flex items-center gap-3 px-7 py-4 rounded-2xl text-white font-bold text-sm sm:text-base transition-all duration-300 hover:-translate-y-1"
                    style={{
                      background:
                        'linear-gradient(95deg, #1e3a8a 0%, #1d4ed8 38%, #2563eb 68%, #dc2626 100%)',
                      border: '1px solid rgba(255, 255, 255, 0.48)',
                      boxShadow:
                        '0 14px 32px -6px rgba(29, 78, 216, 0.72), 0 8px 22px -6px rgba(220, 38, 38, 0.52), inset 0 1px 1.5px rgba(255, 255, 255, 0.55)',
                    }}
                  >
                    <span>Launch AttendX Portal</span>
                    <ArrowRight className="w-5 h-5" />
                  </Link>

                  {/* SECONDARY BUTTON: Transparent Liquid Glass with White Border & Blue/Red Hover */}
                  <Link
                    to="/register/student"
                    className="inline-flex items-center gap-2.5 px-7 py-4 rounded-2xl text-white font-semibold text-sm sm:text-base transition-all duration-300 hover:-translate-y-1 hover:border-white/60"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(37, 99, 235, 0.18) 55%, rgba(220, 38, 38, 0.16) 100%)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.42)',
                      boxShadow:
                        '0 12px 28px -8px rgba(2, 8, 24, 0.45), inset 0 1px 1.5px rgba(255, 255, 255, 0.48)',
                    }}
                  >
                    <GraduationCap className="w-5 h-5 text-sky-200" />
                    <span>Register as Student</span>
                  </Link>
                </div>

                {/* Authentication Info & Faculty Onboarding Bar */}
                <div className="pt-5 border-t border-white/20 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm text-white/90">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-sky-300" />
                    </div>
                    <span>Authenticated UCC Student &amp; Faculty Access</span>
                  </div>

                  <Link
                    to="/register/lecturer"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold text-white transition-all hover:bg-white/20"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(37, 99, 235, 0.32) 0%, rgba(220, 38, 38, 0.32) 100%)',
                      border: '1px solid rgba(255, 255, 255, 0.32)',
                    }}
                  >
                    <span>Faculty Lecturer Onboarding</span>
                    <ChevronRight className="w-4 h-4 text-red-300" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Right 4 Columns: Floating Liquid Glass UCC Live Telemetry Card */}
            <div className="lg:col-span-4 hidden lg:block">
              <div
                className="rounded-3xl p-6 space-y-5 relative overflow-hidden transition-transform duration-300 hover:-translate-y-1"
                style={{
                  background:
                    'linear-gradient(145deg, rgba(255, 255, 255, 0.18) 0%, rgba(15, 38, 88, 0.32) 60%, rgba(220, 38, 38, 0.16) 100%)',
                  backdropFilter: 'blur(24px) saturate(185%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(185%)',
                  border: '1px solid rgba(255, 255, 255, 0.38)',
                  boxShadow:
                    '0 28px 64px -12px rgba(2, 8, 24, 0.65), inset 0 1.5px 2px rgba(255, 255, 255, 0.55)',
                }}
              >
                <div className="flex items-center justify-between border-b border-white/20 pb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src="/images/ucc-official-crest.png"
                      alt="Official UCC Crest"
                      className="w-10 h-11 object-contain drop-shadow"
                    />
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-sky-200">
                        Official Platform
                      </p>
                      <h3 className="text-base font-extrabold text-white">
                        AttendX • UCC Edition
                      </h3>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/30 border border-red-300/40 text-white">
                    Live QR
                  </span>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      label: 'Cryptographic QR Verification',
                      val: 'HMAC-SHA256 Rotating Tokens',
                      dot: 'bg-blue-400',
                    },
                    {
                      label: 'Real-Time Classroom Sync',
                      val: 'Instant WebSocket Streaming',
                      dot: 'bg-white',
                    },
                    {
                      label: 'Departmental Compliance',
                      val: 'PDF & Excel Official Registers',
                      dot: 'bg-red-400',
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md"
                    >
                      <div className="flex items-center gap-2 text-xs text-sky-100/90 font-medium">
                        <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                        <span>{item.label}</span>
                      </div>
                      <p className="text-sm font-bold text-white mt-1 pl-4">{item.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Authentic Campus Photograph Switcher & Caption Pill at Bottom of Hero */}
          <div
            className="mt-12 lg:mt-16 rounded-2xl p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            style={{
              background:
                'linear-gradient(90deg, rgba(8, 24, 58, 0.55) 0%, rgba(255, 255, 255, 0.12) 50%, rgba(88, 18, 36, 0.48) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.28)',
            }}
          >
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4 text-sky-200" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-sky-200">
                  Campus View: {currentCampus.label}
                </p>
                <p className="text-xs text-white/80">{currentCampus.sublabel}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {CAMPUS_BACKGROUNDS.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveCampusIndex(idx)}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  style={
                    activeCampusIndex === idx
                      ? {
                          background:
                            'linear-gradient(90deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
                          color: '#ffffff',
                          border: '1px solid rgba(255, 255, 255, 0.48)',
                          boxShadow: '0 6px 16px -4px rgba(37, 99, 235, 0.65)',
                        }
                      : {
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: '#e2e8f0',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                        }
                  }
                >
                  {item.label.split(' ')[0]} {item.label.split(' ')[1]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          UNIVERSITY IDENTITY & ABOUT SECTION (LIQUID GLASS ON DEEP NAVY/RED/BLUE)
      ===================================================================== */}
      <section
        id="about"
        className="relative py-20 sm:py-24 px-4 sm:px-8 border-t border-white/15 overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 12% 25%, rgba(29, 78, 216, 0.28) 0%, transparent 45%), radial-gradient(circle at 88% 75%, rgba(220, 38, 38, 0.22) 0%, transparent 45%), linear-gradient(180deg, #040d21 0%, #071636 50%, #050f26 100%)',
        }}
      >
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Academic Narrative */}
          <div className="lg:col-span-6 space-y-6">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-white"
              style={{
                background:
                  'linear-gradient(90deg, rgba(37, 99, 235, 0.35) 0%, rgba(220, 38, 38, 0.35) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <Building2 className="w-3.5 h-3.5 text-sky-200" />
              <span>University of Cape Coast • Academic Excellence</span>
            </div>

            <h2 className="font-serif-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Designed for Modern Lecture Theatres Across the{' '}
              <span
                className="text-transparent bg-clip-text"
                style={{
                  backgroundImage: 'linear-gradient(90deg, #93c5fd 0%, #ffffff 50%, #fca5a5 100%)',
                }}
              >
                University of Cape Coast
              </span>
            </h2>

            <p className="text-slate-200/90 text-base leading-relaxed">
              From the Science Complex and Sam Jonah Library precinct to the School of Business and
              Old Site lecture halls, AttendX replaces manual paper attendance sheets with a fast,
              verifiable digital workflow tailored to the University of Cape Coast academic
              structure.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              <div
                className="p-5 rounded-2xl space-y-1.5"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(29, 78, 216, 0.18) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.24)',
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.3)',
                }}
              >
                <p className="text-xs font-bold uppercase tracking-wider text-sky-300">
                  Student Identity
                </p>
                <p className="text-base font-bold text-white">UCC Index Number Verification</p>
                <p className="text-xs text-slate-200/85 leading-relaxed">
                  Supports official UCC index formats (e.g.{' '}
                  <code className="font-mono text-white bg-white/10 px-1.5 py-0.5 rounded">
                    PS/CSC/22/0041
                  </code>
                  ) linked to departments and programmes.
                </p>
              </div>

              <div
                className="p-5 rounded-2xl space-y-1.5"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(220, 38, 38, 0.16) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.24)',
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.3)',
                }}
              >
                <p className="text-xs font-bold uppercase tracking-wider text-red-300">
                  Academic Policy
                </p>
                <p className="text-base font-bold text-white">Automated Compliance Tracking</p>
                <p className="text-xs text-slate-200/85 leading-relaxed">
                  Real-time calculation of course attendance percentages for both students and
                  faculty lecturers.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white text-sm font-bold transition-all hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(95deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  boxShadow: '0 10px 24px -6px rgba(37, 99, 235, 0.6)',
                }}
              >
                <span>Access University Portal</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/register/lecturer"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white text-sm font-semibold transition-all hover:-translate-y-0.5 hover:bg-white/20"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                }}
              >
                <span>Lecturer Registration</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Authentic UCC Campus Photography Grid with Liquid Glass Overlays */}
          <div className="lg:col-span-6 grid sm:grid-cols-12 gap-5 items-stretch">
            <div className="sm:col-span-7 relative rounded-3xl overflow-hidden shadow-2xl border border-white/25 group min-h-[340px]">
              <img
                src="/images/ucc-library-complex.jpg"
                alt="Sam Jonah Library Complex at the University of Cape Coast"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#040d21]/90 via-[#040d21]/20 to-transparent" />
              <div
                className="absolute bottom-4 left-4 right-4 p-4 rounded-2xl text-white"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(10, 26, 62, 0.55) 100%)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full text-white"
                  style={{
                    background: 'linear-gradient(90deg, #1d4ed8 0%, #dc2626 100%)',
                  }}
                >
                  North Campus
                </span>
                <h3 className="text-base font-bold mt-1.5">Sam Jonah Library Complex</h3>
                <p className="text-xs text-slate-200">
                  Central academic research hub at the University of Cape Coast
                </p>
              </div>
            </div>

            <div className="sm:col-span-5 flex flex-col justify-between gap-5">
              <div className="relative rounded-3xl overflow-hidden shadow-xl border border-white/25 flex-1 min-h-[195px] group">
                <img
                  src="/images/ucc-admin-block.jpg"
                  alt="University of Cape Coast Central Administration Building"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#040d21]/90 via-transparent to-transparent" />
                <div className="absolute bottom-3.5 left-3.5 right-3.5 p-3 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 text-white">
                  <p className="text-xs font-bold">Central Administration</p>
                  <p className="text-[11px] text-slate-200">University of Cape Coast</p>
                </div>
              </div>

              <div
                className="p-5 rounded-3xl text-white space-y-2"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(29, 78, 216, 0.38) 0%, rgba(255, 255, 255, 0.12) 50%, rgba(220, 38, 38, 0.34) 100%)',
                  backdropFilter: 'blur(22px)',
                  border: '1px solid rgba(255, 255, 255, 0.34)',
                  boxShadow: 'inset 0 1px 1.5px rgba(255, 255, 255, 0.45)',
                }}
              >
                <p className="text-xs font-bold uppercase tracking-widest text-red-200">
                  2026/2027 Semester Ready
                </p>
                <p className="font-serif-display text-xl font-bold leading-snug">
                  Multi-Faculty Smart Classroom Infrastructure
                </p>
                <p className="text-xs text-slate-100/90 leading-relaxed">
                  Supporting Physical Sciences, Business, Education, Humanities, and Allied Health
                  Sciences.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          8. HOW IT WORKS SECTION – THREE LIQUID GLASS CARDS (01, 02, 03)
      ===================================================================== */}
      <section
        id="how-it-works"
        className="relative py-20 sm:py-24 px-4 sm:px-8 border-t border-white/15 overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 50% 15%, rgba(37, 99, 235, 0.26) 0%, transparent 55%), radial-gradient(circle at 85% 85%, rgba(220, 38, 38, 0.2) 0%, transparent 45%), #051129',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <span
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white px-4 py-1.5 rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, rgba(29, 78, 216, 0.45) 0%, rgba(220, 38, 38, 0.45) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.32)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <Sparkles className="w-3.5 h-3.5 text-red-300" />
              <span>Classroom Workflow</span>
            </span>
            <h2 className="font-serif-display text-3xl sm:text-5xl font-bold text-white">
              How AttendX Works in the Lecture Hall
            </h2>
            <p className="text-slate-200/90 text-base">
              A seamless three-step verification flow designed for busy university lecture theatres.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className="relative group rounded-3xl p-8 transition-all duration-300 hover:-translate-y-2 flex flex-col justify-between overflow-hidden"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(15, 38, 88, 0.30) 58%, rgba(220, 38, 38, 0.14) 100%)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    border: '1px solid rgba(255, 255, 255, 0.32)',
                    boxShadow:
                      '0 24px 54px -12px rgba(2, 8, 24, 0.6), inset 0 1.5px 2px rgba(255, 255, 255, 0.48)',
                  }}
                >
                  {/* Top Specular Edge Reflection */}
                  <div
                    className="absolute top-0 left-[12%] right-[12%] h-[1.5px] pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent 0%, rgba(147, 197, 253, 0.85) 30%, rgba(255, 255, 255, 0.95) 50%, rgba(252, 165, 165, 0.85) 70%, transparent 100%)',
                    }}
                  />

                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.accent} text-white flex items-center justify-center shadow-lg border border-white/35 group-hover:scale-105 transition-transform`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <span
                        className="font-serif-display text-4xl font-extrabold text-transparent bg-clip-text"
                        style={{
                          backgroundImage:
                            'linear-gradient(135deg, #ffffff 0%, #93c5fd 50%, #fca5a5 100%)',
                        }}
                      >
                        {step.number}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-300">
                        <span>Step {step.number}</span>
                      </div>
                      <h3 className="text-xl font-bold text-white">
                        {step.number} – {step.title}
                      </h3>
                      <p className="text-slate-100/95 text-sm sm:text-base font-medium leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  <p className="mt-6 pt-4 border-t border-white/20 text-xs text-slate-200/80 leading-relaxed">
                    {step.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          8. FEATURES SECTION – SIX LIQUID GLASS FEATURE CARDS
      ===================================================================== */}
      <section
        id="features"
        className="relative py-20 sm:py-24 px-4 sm:px-8 border-t border-white/15 overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 82% 22%, rgba(29, 78, 216, 0.28) 0%, transparent 48%), radial-gradient(circle at 18% 78%, rgba(220, 38, 38, 0.22) 0%, transparent 48%), linear-gradient(180deg, #040d21 0%, #071738 100%)',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-6">
            <div className="space-y-3 max-w-2xl">
              <span
                className="inline-block text-xs font-bold uppercase tracking-widest text-white px-4 py-1.5 rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(29, 78, 216, 0.45) 0%, rgba(220, 38, 38, 0.45) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.32)',
                  backdropFilter: 'blur(14px)',
                }}
              >
                Platform Capabilities
              </span>
              <h2 className="font-serif-display text-3xl sm:text-5xl font-bold text-white">
                Built for Academic Integrity, Speed and Reliability
              </h2>
            </div>
            <p className="text-sm sm:text-base text-slate-200/90 max-w-md">
              Every component of AttendX is engineered to support lecturers, students, and academic
              administrators with real-time attendance intelligence.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {CORE_FEATURES.map((feat, idx) => {
              const Icon = feat.icon;
              const isRedAccent = idx % 2 === 1;
              return (
                <div
                  key={idx}
                  className="group relative rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between overflow-hidden"
                  style={{
                    background: isRedAccent
                      ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(15, 36, 82, 0.28) 55%, rgba(220, 38, 38, 0.16) 100%)'
                      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(29, 78, 216, 0.24) 60%, rgba(220, 38, 38, 0.1) 100%)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    boxShadow:
                      '0 22px 48px -12px rgba(2, 8, 24, 0.55), inset 0 1px 1.5px rgba(255, 255, 255, 0.45)',
                  }}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div
                        className="w-12 h-12 rounded-2xl text-white flex items-center justify-center shadow-md transition-transform group-hover:scale-105"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(29, 78, 216, 0.85) 0%, rgba(220, 38, 38, 0.78) 100%)',
                          border: '1px solid rgba(255, 255, 255, 0.4)',
                        }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/12 border border-white/25 text-sky-100">
                        {feat.tag}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white">{feat.title}</h3>
                    <p className="text-sm text-slate-200/90 leading-relaxed">{feat.description}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs font-semibold text-sky-200">
                    <span>University of Cape Coast Standard</span>
                    <CheckCircle2 className="w-4 h-4 text-red-300" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          ROLE ACCESS LIQUID GLASS BANNER
      ===================================================================== */}
      <section className="relative py-20 px-4 sm:px-8 border-t border-white/15 overflow-hidden bg-[#040d21]">
        <div
          className="max-w-7xl mx-auto rounded-3xl p-8 sm:p-12 grid lg:grid-cols-12 gap-10 items-center relative overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, rgba(29, 78, 216, 0.38) 0%, rgba(255, 255, 255, 0.14) 50%, rgba(220, 38, 38, 0.36) 100%)',
            backdropFilter: 'blur(26px) saturate(185%)',
            WebkitBackdropFilter: 'blur(26px) saturate(185%)',
            border: '1px solid rgba(255, 255, 255, 0.38)',
            boxShadow:
              '0 30px 70px -14px rgba(2, 8, 24, 0.7), inset 0 1.5px 2px rgba(255, 255, 255, 0.55)',
          }}
        >
          <div className="lg:col-span-7 space-y-4">
            <span className="text-xs font-bold uppercase tracking-widest text-red-200">
              University of Cape Coast • 2026/2027 Academic Year
            </span>
            <h2 className="font-serif-display text-3xl sm:text-4xl font-bold text-white leading-tight">
              Ready to Access the AttendX University Portal?
            </h2>
            <p className="text-slate-100/90 text-sm sm:text-base max-w-2xl leading-relaxed">
              Sign in with your University of Cape Coast email, Student Index Number, or Lecturer
              Staff ID to manage courses, project classroom QR codes, or scan attendance.
            </p>
          </div>

          <div className="lg:col-span-5 flex flex-wrap lg:justify-end gap-3.5">
            <Link
              to="/login"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-white font-bold text-sm shadow-xl transition-all hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(95deg, #1d4ed8 0%, #2563eb 55%, #dc2626 100%)',
                border: '1px solid rgba(255, 255, 255, 0.45)',
              }}
            >
              <span>Launch AttendX Portal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/register/student"
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/35 text-white font-semibold text-sm transition-all hover:-translate-y-0.5"
            >
              <GraduationCap className="w-4 h-4 text-sky-200" />
              <span>Student Portal</span>
            </Link>
            <Link
              to="/register/lecturer"
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/35 text-white font-semibold text-sm transition-all hover:-translate-y-0.5"
            >
              <BookOpen className="w-4 h-4 text-red-200" />
              <span>Lecturer Portal</span>
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================================
          PROFESSIONAL UNIVERSITY FOOTER
      ===================================================================== */}
      <footer className="bg-[#030917] text-slate-300 border-t border-white/15 pt-16 pb-12 px-4 sm:px-8 mt-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/15">
          {/* Column 1: AttendX Logo & University of Cape Coast */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/25 flex items-center justify-center">
                <img
                  src="/images/ucc-official-crest.png"
                  alt="UCC Crest"
                  className="w-7 h-8 object-contain"
                />
              </div>
              <div>
                <span className="font-serif-display font-bold text-xl text-white">AttendX</span>
                <p className="text-xs text-red-300 font-semibold">University of Cape Coast</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300/85 leading-relaxed max-w-sm">
              Smart University Attendance Management Platform providing cryptographic QR classroom
              verification, real-time attendance monitoring, and departmental analytics for the
              University of Cape Coast.
            </p>
          </div>

          {/* Column 2: Quick Navigation Links */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Quick Navigation
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-300/85">
              <li>
                <a href="#home" className="hover:text-white transition">
                  Home
                </a>
              </li>
              <li>
                <a href="#about" className="hover:text-white transition">
                  About AttendX
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition">
                  Features
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: University Portals */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Academic Portals
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-300/85">
              <li>
                <Link to="/register/student" className="hover:text-white transition">
                  Student Portal &amp; Registration
                </Link>
              </li>
              <li>
                <Link to="/register/lecturer" className="hover:text-white transition">
                  Lecturer Portal &amp; Onboarding
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition">
                  Sign In to AttendX
                </Link>
              </li>
              <li>
                <Link to="/forgot-password" className="hover:text-white transition">
                  Account Password Recovery
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact Information */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Contact Information
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300/85">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>University of Cape Coast, Cape Coast, Central Region, Ghana</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                <span>awalsarpong4@gmail.com</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-red-400 shrink-0" />
                <span>+233 538729517</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                <span>www.ucc.edu.gh</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright Row */}
        <div className="max-w-7xl mx-auto pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>
            &copy; {new Date().getFullYear()} AttendX – Smart University Attendance Management
            System. University of Cape Coast (UCC). All rights reserved.
          </p>
          <p className="text-slate-400">
            2026/2027 Academic Year • Campus Photography: UCC Main Entrance &amp; Sam Jonah Library
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
