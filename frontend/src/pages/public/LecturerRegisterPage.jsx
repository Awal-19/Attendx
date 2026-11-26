import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  QrCode,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  Award,
  User,
  Hash,
  Mail,
  Building2,
  Lock,
  Eye,
  EyeOff,
  BookOpen,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';

const LecturerRegisterPage = () => {
  const { register } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    title: 'Dr.',
    full_name: '',
    staff_id: '',
    email: '',
    password: '',
    department_id: '',
    department_name: '',
    specialization: '',
    office_location: 'Science Complex Block B',
    phone_number: '',
  });

  useEffect(() => {
    api
      .get('/academics/departments/')
      .then((res) => {
        setDepartments(res.data);
        if (res.data.length > 0) {
          setFormData((prev) => ({ ...prev, department_id: res.data[0].id }));
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await register({
        ...formData,
        role: 'LECTURER',
      });
      addToast(
        'Lecturer account created! You can now create courses and start QR attendance sessions.',
        'success'
      );
      navigate('/lecturer/dashboard');
    } catch (err) {
      const data = err.response?.data;
      const firstErr =
        data?.email?.[0] ||
        data?.staff_id?.[0] ||
        data?.password?.[0] ||
        data?.non_field_errors?.[0] ||
        'Registration failed.';
      addToast(firstErr, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* Embedded Apple Liquid Glass Styles & Micro-Animations */}
      <style>{`
        @keyframes lectCardFloatIn {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes lectAmbientPulse {
          0%, 100% {
            opacity: 0.55;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.06);
          }
        }
        .ucc-lect-glass-card {
          animation: lectCardFloatIn 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          background: linear-gradient(
            145deg,
            rgba(255, 255, 255, 0.13) 0%,
            rgba(15, 34, 78, 0.36) 45%,
            rgba(7, 17, 42, 0.44) 85%,
            rgba(185, 28, 28, 0.12) 100%
          );
          backdrop-filter: blur(25px) saturate(175%);
          -webkit-backdrop-filter: blur(25px) saturate(175%);
          border: 1px solid rgba(255, 255, 255, 0.24);
          box-shadow:
            0 30px 70px -15px rgba(2, 6, 23, 0.72),
            0 0 38px -10px rgba(37, 99, 235, 0.28),
            0 0 28px -12px rgba(220, 38, 38, 0.18),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.34),
            inset 0 -1px 0 0 rgba(255, 255, 255, 0.08);
        }
        .ucc-lect-input {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.09) 0%,
            rgba(6, 16, 40, 0.44) 100%
          );
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow:
            inset 0 1px 0 0 rgba(255, 255, 255, 0.12),
            0 4px 14px -4px rgba(2, 6, 23, 0.35);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ucc-lect-input:hover {
          border-color: rgba(255, 255, 255, 0.32);
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.13) 0%,
            rgba(10, 24, 58, 0.5) 100%
          );
        }
        .ucc-lect-input:focus {
          outline: none;
          border-color: rgba(96, 165, 250, 0.75);
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
        .ucc-lect-input option {
          background-color: #071430;
          color: #ffffff;
        }
        .ucc-lect-btn-primary {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 54%, #b91c1c 92%, #dc2626 100%);
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow:
            0 16px 36px -8px rgba(37, 99, 235, 0.55),
            0 8px 24px -6px rgba(220, 38, 38, 0.38),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.38);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ucc-lect-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #dc2626 90%, #ef4444 100%);
          box-shadow:
            0 20px 44px -8px rgba(37, 99, 235, 0.7),
            0 12px 28px -6px rgba(220, 38, 38, 0.52),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.5);
        }
        .ucc-lect-btn-primary:active:not(:disabled) {
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
        {/* Balanced Navy Overlay Preserving UCC Entrance Clarity */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, rgba(4, 13, 33, 0.62) 0%, rgba(7, 20, 48, 0.46) 50%, rgba(4, 13, 33, 0.68) 100%)',
          }}
        />
        {/* Royal Blue Ambient Lighting (Top-Left) */}
        <div
          className="absolute -top-24 -left-24 w-[32rem] h-[32rem] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.32) 0%, transparent 70%)',
            filter: 'blur(55px)',
            animation: 'lectAmbientPulse 9s ease-in-out infinite',
          }}
        />
        {/* Subtle UCC Crimson Red Ambient Glow (Bottom-Right) */}
        <div
          className="absolute -bottom-24 -right-20 w-[30rem] h-[30rem] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(220, 38, 38, 0.24) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'lectAmbientPulse 11s ease-in-out infinite reverse',
          }}
        />
      </div>

      {/* Main Content Wrapper */}
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-2xl">
        {/* Top Floating Back to Home Pill & Institutional Crest Header */}
        <div className="text-center mb-6">
          <Link
            to="/"
            className="group inline-flex items-center gap-3.5 px-4 py-2 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
            style={{
              background: 'rgba(10, 24, 56, 0.42)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              boxShadow:
                '0 12px 28px -8px rgba(2, 6, 23, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.28)',
            }}
          >
            {/* Official UCC Crest */}
            <div className="w-10 h-10 rounded-xl bg-white/95 p-1 flex items-center justify-center shadow-md border border-white/60">
              <img
                src="/images/ucc-official-crest.png"
                alt="University of Cape Coast Crest"
                className="w-full h-full object-contain"
              />
            </div>

            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
                border: '1px solid rgba(255, 255, 255, 0.35)',
              }}
            >
              <QrCode className="w-4 h-4 text-white" />
            </div>

            <div className="text-left pr-1">
              <span className="block font-extrabold text-xl tracking-tight text-white leading-none">
                AttendX <span className="text-red-400">•</span>{' '}
                <span className="text-blue-200">UCC Faculty</span>
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200/85 mt-0.5">
                University of Cape Coast
              </span>
            </div>
          </Link>

          {/* Main Lecturer Onboarding Heading */}
          <div className="mt-5 flex flex-col items-center">
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full mb-2.5"
              style={{
                background:
                  'linear-gradient(90deg, rgba(29, 78, 216, 0.38) 0%, rgba(15, 23, 42, 0.45) 50%, rgba(220, 38, 38, 0.32) 100%)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.22)',
              }}
            >
              <UserCheck className="w-4 h-4 text-blue-300" />
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/95">
                Official Faculty Onboarding Portal
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(2,6,23,0.6)]">
              Lecturer Portal{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #ffffff 0%, #93c5fd 55%, #f87171 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Onboarding
              </span>
            </h1>

            <p className="mt-1.5 text-xs sm:text-sm text-blue-100/90 max-w-lg font-medium drop-shadow">
              Create your faculty profile to manage courses and project classroom QR attendance
              codes.
            </p>
          </div>
        </div>

        {/* Liquid Glass Lecturer Onboarding Card */}
        <div className="ucc-lect-glass-card relative rounded-3xl py-7 px-5 sm:px-9 sm:py-8 overflow-hidden">
          {/* Top Multi-Color Specular Rim Light (Blue -> White -> Crimson Red) */}
          <div
            className="absolute top-0 inset-x-0 h-[2px]"
            style={{
              background:
                'linear-gradient(90deg, transparent 5%, rgba(59, 130, 246, 0.85) 28%, rgba(255, 255, 255, 0.95) 50%, rgba(239, 68, 68, 0.85) 72%, transparent 95%)',
            }}
          />

          {/* Subtle Inner Corner Glass Reflections */}
          <div
            className="absolute -top-20 -left-20 w-52 h-52 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)',
              filter: 'blur(25px)',
            }}
          />
          <div
            className="absolute -bottom-20 -right-20 w-52 h-52 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(220, 38, 38, 0.18) 0%, transparent 70%)',
              filter: 'blur(25px)',
            }}
          />

          <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
            {/* Row 1: Academic Title & Full Name */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>Academic Title</span>
                </label>
                <div className="relative">
                  <Award className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="ucc-lect-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white text-sm font-medium"
                  >
                    {['Dr.', 'Prof.', 'Mr.', 'Mrs.', 'Ms.', 'Ing.'].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span>Full Name</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Sarpong Awal"
                    className="ucc-lect-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: University Staff ID & Faculty Email */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>University Staff ID</span>
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={formData.staff_id}
                    onChange={(e) =>
                      setFormData({ ...formData, staff_id: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. UCC/STAFF/2099"
                    className="ucc-lect-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white placeholder-blue-100/45 font-mono text-sm font-semibold tracking-wide"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span>Faculty Email</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="lecturer@ucc.edu.gh"
                    className="ucc-lect-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Department & Password */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>Department</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {departments.length > 0 ? (
                    <select
                      value={formData.department_id}
                      onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                      className="ucc-lect-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white text-sm font-medium"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={formData.department_name}
                      onChange={(e) =>
                        setFormData({ ...formData, department_name: e.target.value })
                      }
                      placeholder="e.g. Department of Computer Science & IT"
                      className="ucc-lect-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span>Password (Min 8 chars)</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••••••"
                    className="ucc-lect-input w-full pl-10 pr-10 py-2.5 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200/75 hover:text-white transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Row 4: Specialization & Office Location */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>Specialization</span>
                </label>
                <div className="relative">
                  <BookOpen className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    placeholder="e.g. Artificial Intelligence & Systems"
                    className="ucc-lect-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                  <span>Office Location</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.office_location}
                    onChange={(e) => setFormData({ ...formData, office_location: e.target.value })}
                    placeholder="Science Complex Block B, Room 204"
                    className="ucc-lect-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button: Royal Blue to UCC Crimson Red Liquid Glass Gradient */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="ucc-lect-btn-primary w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl disabled:opacity-60 text-white font-bold text-sm tracking-wide cursor-pointer"
              >
                <span>
                  {submitting ? 'Registering Faculty Account...' : 'Create Lecturer Account'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Bottom Glass Divider & Portal Navigation Links */}
          <div className="relative z-10 mt-6 pt-5 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <Link
              to="/lecturer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white/90 hover:text-white font-semibold transition-all"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5 text-blue-300" />
              <span>Back to</span>
              <span className="text-blue-300 underline decoration-blue-400/60 underline-offset-4">
                Sign In
              </span>
            </Link>

            <Link
              to="/register/student"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white/90 hover:text-white font-semibold transition-all"
              style={{
                background:
                  'linear-gradient(135deg, rgba(29, 78, 216, 0.24) 0%, rgba(220, 38, 38, 0.22) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <span>Student Registration</span>
              <span className="text-red-300 font-bold">→</span>
            </Link>
          </div>
        </div>

        {/* Subtle Institutional Footer Tag */}
        <p className="mt-4 text-center text-[11px] font-medium text-blue-100/75 tracking-wide drop-shadow">
          AttendX • University of Cape Coast Smart Attendance &amp; Academic Verification Platform
        </p>
      </div>
    </div>
  );
};

export default LecturerRegisterPage;
