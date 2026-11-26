import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  QrCode,
  GraduationCap,
  ArrowRight,
  User,
  Hash,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  BookOpen,
  Layers,
  Phone,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';

const StudentRegisterPage = () => {
  const { register, verifyRegistrationOtp } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpStep, setOtpStep] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [accessReason, setAccessReason] = useState('');
  const [submittingAccess, setSubmittingAccess] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    index_number: '',
    email: '',
    password: '',
    department_id: '',
    department_name: '',
    programme_id: '',
    programme_name: '',
    academic_level: '300',
    phone_number: '',
  });

  useEffect(() => {
    const loadAcademics = async () => {
      try {
        const [deptRes, progRes] = await Promise.all([
          api.get('/academics/departments/'),
          api.get('/academics/programmes/'),
        ]);
        setDepartments(deptRes.data);
        setProgrammes(progRes.data);
        if (deptRes.data.length > 0) {
          const firstDept = deptRes.data[0].id;
          const matchingProgs = progRes.data.filter((p) => p.department === firstDept);
          setFormData((prev) => ({
            ...prev,
            department_id: firstDept,
            programme_id: matchingProgs[0]?.id || progRes.data[0]?.id || '',
          }));
        }
      } catch {
        // fallback if offline
      }
    };
    loadAcademics();
  }, []);

  const filteredProgrammes = programmes.filter(
    (p) => !formData.department_id || p.department === formData.department_id
  );

  const handleDepartmentChange = (deptId) => {
    const matching = programmes.filter((p) => p.department === deptId);
    setFormData((prev) => ({
      ...prev,
      department_id: deptId,
      programme_id: matching[0]?.id || '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setAlreadyRegistered(false);
    try {
      const result = await register({
        ...formData,
        role: 'STUDENT',
      });
      if (result?.requires_otp) {
        setOtpStep({
          index_number: result.index_number,
          destination: result.destination,
          delivery_channel: result.delivery_channel,
        });
        addToast(result.message, 'info', 'Verification Code Sent');
        return;
      }
      const isVerified = result?.student_profile?.verification_status === 'VERIFIED';
      addToast(
        isVerified
          ? 'Your UCC Student account has been verified against university records!'
          : 'Account created! Your academic details are pending institutional verification.',
        'success',
        isVerified ? 'Verified Registration' : 'Registration Submitted'
      );
      navigate('/student/dashboard');
    } catch (err) {
      const data = err.response?.data;
      if (data?.already_registered) {
        setAlreadyRegistered(true);
      }
      const firstErr =
        (Array.isArray(data?.error) ? data.error[0] : data?.error) ||
        data?.email?.[0] ||
        data?.index_number?.[0] ||
        data?.password?.[0] ||
        data?.non_field_errors?.[0] ||
        'Registration failed. Please verify all fields.';
      addToast(firstErr, 'error', 'Registration Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpStep || !otpCode.trim()) return;
    setVerifyingOtp(true);
    try {
      await verifyRegistrationOtp(otpStep.index_number, otpCode.trim());
      addToast('Your UCC Student account is now verified and active!', 'success', 'Account Activated');
      navigate('/student/dashboard');
    } catch (err) {
      addToast(err.response?.data?.error || 'Invalid or expired verification code.', 'error', 'Verification Failed');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!otpStep) return;
    setResendingOtp(true);
    try {
      const res = await api.post('/auth/register/resend-otp/', { index_number: otpStep.index_number });
      addToast(res.data.message, 'info', 'Code Resent');
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not resend code right now.', 'error');
    } finally {
      setResendingOtp(false);
    }
  };

  const handleAccessRequest = async (e) => {
    e.preventDefault();
    setSubmittingAccess(true);
    try {
      const res = await api.post('/students/access-requests/', {
        index_number: formData.index_number,
        full_name: formData.full_name,
        institutional_email: formData.email,
        phone_number: formData.phone_number,
        department_id: formData.department_id,
        programme_id: formData.programme_id,
        academic_level: formData.academic_level,
        reason: accessReason,
      });
      addToast(res.data.message, 'success', 'Access Request Submitted');
      setShowAccessRequest(false);
      setAccessReason('');
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not submit access request.', 'error');
    } finally {
      setSubmittingAccess(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 overflow-x-hidden selection:bg-blue-600 selection:text-white">
      <style>{`
        @keyframes regCardFloatIn {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes regAmbientPulse {
          0%, 100% {
            opacity: 0.55;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.06);
          }
        }
        .ucc-reg-glass-card {
          animation: regCardFloatIn 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
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
        .ucc-reg-input {
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
        .ucc-reg-input:hover {
          border-color: rgba(255, 255, 255, 0.32);
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.13) 0%,
            rgba(10, 24, 58, 0.5) 100%
          );
        }
        .ucc-reg-input:focus {
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
        .ucc-reg-input option {
          background-color: #071430;
          color: #ffffff;
        }
        .ucc-reg-btn-primary {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 54%, #b91c1c 92%, #dc2626 100%);
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow:
            0 16px 36px -8px rgba(37, 99, 235, 0.55),
            0 8px 24px -6px rgba(220, 38, 38, 0.38),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.38);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ucc-reg-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #dc2626 90%, #ef4444 100%);
          box-shadow:
            0 20px 44px -8px rgba(37, 99, 235, 0.7),
            0 12px 28px -6px rgba(220, 38, 38, 0.52),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.5);
        }
        .ucc-reg-btn-primary:active:not(:disabled) {
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
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, rgba(4, 13, 33, 0.62) 0%, rgba(7, 20, 48, 0.46) 50%, rgba(4, 13, 33, 0.68) 100%)',
          }}
        />
        <div
          className="absolute -top-24 -left-24 w-[32rem] h-[32rem] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.32) 0%, transparent 70%)',
            filter: 'blur(55px)',
            animation: 'regAmbientPulse 9s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-24 -right-20 w-[30rem] h-[30rem] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(220, 38, 38, 0.24) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'regAmbientPulse 11s ease-in-out infinite reverse',
          }}
        />
      </div>

      {/* Main Content Wrapper */}
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-2xl">
        {/* Header */}
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
                <span className="text-blue-200">UCC</span>
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200/85 mt-0.5">
                University of Cape Coast
              </span>
            </div>
          </Link>

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
              <GraduationCap className="w-4 h-4 text-blue-300" />
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/95">
                Official Student Onboarding Portal
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(2,6,23,0.6)]">
              Student Account{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #ffffff 0%, #93c5fd 55%, #f87171 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Registration
              </span>
            </h1>

            <p className="mt-1.5 text-xs sm:text-sm text-blue-100/90 max-w-md font-medium drop-shadow">
              Register with your University of Cape Coast Index Number and Institutional Email.
            </p>
          </div>
        </div>

        {/* Liquid Glass Registration Form Card */}
        <div className="ucc-reg-glass-card relative rounded-3xl py-7 px-5 sm:px-9 sm:py-8 overflow-hidden">
          <div
            className="absolute top-0 inset-x-0 h-[2px]"
            style={{
              background:
                'linear-gradient(90deg, transparent 5%, rgba(59, 130, 246, 0.85) 28%, rgba(255, 255, 255, 0.95) 50%, rgba(239, 68, 68, 0.85) 72%, transparent 95%)',
            }}
          />

          <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
            {/* Row 1: Full Name & Student Index Number */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>Full Name</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Awal Sarpong"
                    className="ucc-reg-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span>Student Index Number</span>
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={formData.index_number}
                    onChange={(e) =>
                      setFormData({ ...formData, index_number: e.target.value.toUpperCase() })
                    }
                    placeholder="PS/CSC/24/0044"
                    className="ucc-reg-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white placeholder-blue-100/45 font-mono text-sm font-semibold tracking-wide"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Institutional Email & Password */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>Institutional Email</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="student@stu.ucc.edu.gh"
                    className="ucc-reg-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium"
                  />
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
                    className="ucc-reg-input w-full pl-10 pr-10 py-2.5 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium"
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

            {/* Row 3: Department & Degree Programme */}
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
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                      className="ucc-reg-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white text-sm font-medium"
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
                      className="ucc-reg-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span>Programme</span>
                </label>
                <div className="relative">
                  <BookOpen className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {filteredProgrammes.length > 0 ? (
                    <select
                      value={formData.programme_id}
                      onChange={(e) => setFormData({ ...formData, programme_id: e.target.value })}
                      className="ucc-reg-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white text-sm font-medium"
                    >
                      {filteredProgrammes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={formData.programme_name}
                      onChange={(e) =>
                        setFormData({ ...formData, programme_name: e.target.value })
                      }
                      placeholder="e.g. B.Sc. Computer Science"
                      className="ucc-reg-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Row 4: Academic Level & Phone Number (Optional) */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>Academic Level</span>
                </label>
                <div className="relative">
                  <Layers className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={formData.academic_level}
                    onChange={(e) => setFormData({ ...formData, academic_level: e.target.value })}
                    className="ucc-reg-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white text-sm font-medium"
                  >
                    {['100', '200', '300', '400', '500', '600'].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        Level {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/95 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                  <span>Phone Number (Optional)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-blue-200/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    placeholder="+233 54 000 0000"
                    className="ucc-reg-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-white placeholder-blue-100/45 text-sm font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Institutional Verification Notice */}
            <div
              className="p-3 rounded-xl flex items-start gap-2.5 text-[11px] text-blue-100/90"
              style={{
                background: 'rgba(15, 34, 78, 0.42)',
                border: '1px solid rgba(147, 197, 253, 0.22)',
              }}
            >
              <ShieldCheck className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
              <span>
                Academic placement (Department, Programme, Level) is verified against official
                University of Cape Coast student records and cannot be self-altered after
                verification.
              </span>
            </div>

            {/* Submit Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="ucc-reg-btn-primary w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl disabled:opacity-60 text-white font-bold text-sm tracking-wide cursor-pointer"
              >
                <span>
                  {submitting ? 'Verifying Class List...' : 'Complete Student Registration'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {alreadyRegistered && (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-300/35 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-2">
                <span>An account already exists for this index number.</span>
                <div className="flex items-center gap-3 font-bold">
                  <Link to="/login" className="underline text-white">Sign In</Link>
                  <Link to="/forgot-password" className="underline text-blue-200">Reset Password</Link>
                </div>
              </div>
            )}

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowAccessRequest((v) => !v)}
                className="text-xs font-semibold text-blue-200 hover:text-white underline underline-offset-4 cursor-pointer"
              >
                Not on the class list yet? Request Access from your Lecturer
              </button>
            </div>
          </form>

          {otpStep && (
            <form onSubmit={handleVerifyOtp} className="relative z-10 mt-6 p-5 rounded-2xl bg-blue-950/60 border border-blue-300/30 space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-white">Enter 6-Digit Verification Code</h3>
                <p className="text-xs text-blue-100/85 mt-1">
                  Sent via {otpStep.delivery_channel} to <span className="font-bold text-white">{otpStep.destination}</span>. Expires in 10 minutes.
                </p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                className="ucc-reg-input w-full px-4 py-3 rounded-xl text-white text-center font-mono text-lg tracking-[0.4em]"
              />
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="submit"
                  disabled={verifyingOtp || otpCode.length !== 6}
                  className="ucc-reg-btn-primary flex-1 py-3 px-4 rounded-xl text-white font-bold text-sm disabled:opacity-60 cursor-pointer"
                >
                  {verifyingOtp ? 'Activating Account...' : 'Verify & Activate Account'}
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendingOtp}
                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 cursor-pointer"
                >
                  {resendingOtp ? 'Sending...' : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {showAccessRequest && !otpStep && (
            <form onSubmit={handleAccessRequest} className="relative z-10 mt-5 p-4 rounded-2xl bg-slate-950/55 border border-white/20 space-y-3">
              <p className="text-xs font-bold text-white">
                Request Class-List Access (uses the Index Number, Name &amp; Email entered above)
              </p>
              <textarea
                rows={2}
                value={accessReason}
                onChange={(e) => setAccessReason(e.target.value)}
                placeholder="Optional note for your lecturer/admin (e.g. late registration or transferred student)"
                className="ucc-reg-input w-full px-3 py-2 rounded-xl text-white text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAccessRequest(false)}
                  className="px-3 py-2 rounded-xl text-xs text-blue-200 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAccess}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {submittingAccess ? 'Submitting...' : 'Submit Access Request'}
                </button>
              </div>
            </form>
          )}

          {/* Bottom Glass Divider & Sign In Link */}
          <div className="relative z-10 mt-6 pt-5 border-t border-white/15 flex items-center justify-center text-xs">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white/90 hover:text-white font-semibold transition-all"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5 text-blue-300" />
              <span>Already have an account?</span>
              <span className="text-blue-300 underline decoration-blue-400/60 underline-offset-4">
                Sign In
              </span>
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] font-medium text-blue-100/75 tracking-wide drop-shadow">
          AttendX • University of Cape Coast Smart Attendance &amp; Academic Verification Platform
        </p>
      </div>
    </div>
  );
};

export default StudentRegisterPage;
