import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, ShieldAlert, ArrowRight, QrCode } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getRoleHomePath } from '../../components/common/ProtectedRoute';

const QrScanLandingPage = () => {
  const { token: paramToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = (paramToken || searchParams.get('t') || searchParams.get('token') || '').trim();

  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const submittedRef = useRef(false);

  const [statusState, setStatusState] = useState('checking'); // checking | success | error | forbidden
  const [message, setMessage] = useState('Verifying attendance QR code...');
  const [courseInfo, setCourseInfo] = useState(null);

  useEffect(() => {
    if (loading) return;

    if (!token) {
      setStatusState('error');
      setMessage('Invalid QR link. No attendance token was found.');
      return;
    }

    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/a/${token}`)}`, { replace: true });
      return;
    }

    if (user.role !== 'STUDENT') {
      setStatusState('forbidden');
      setMessage('Only students can mark attendance.');
      return;
    }

    if (submittedRef.current) return;
    submittedRef.current = true;

    (async () => {
      try {
        const valRes = await api.post('/attendance/scan/validate-qr/', { token });
        const session = valRes.data?.session;
        setCourseInfo(session || null);

        if (valRes.data.requires_face_verification || valRes.data.face_registration_required) {
          navigate(`/student/scan?t=${encodeURIComponent(token)}`, { replace: true });
          return;
        }

        const scanRes = await api.post('/attendance/scan/', {
          token,
          use_alternative: true,
          device_info: navigator.userAgent,
        });
        setStatusState('success');
        setMessage(
          scanRes.data?.message ||
            `Attendance marked for ${session?.course_code || 'your class'}`
        );
      } catch (err) {
        setStatusState('error');
        setMessage(
          err.response?.data?.error ||
            'Could not mark attendance. The QR code may have expired or is invalid.'
        );
      }
    })();
  }, [loading, user, token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#061430] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-3xl bg-white/10 border border-white/20 backdrop-blur-xl p-8 text-center shadow-2xl">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-white/10 border border-white/20">
          {statusState === 'checking' && (
            <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {statusState === 'success' && <CheckCircle2 className="w-7 h-7 text-emerald-400" />}
          {statusState === 'error' && <AlertCircle className="w-7 h-7 text-red-400" />}
          {statusState === 'forbidden' && <ShieldAlert className="w-7 h-7 text-amber-400" />}
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold uppercase tracking-wider mb-3">
          <QrCode className="w-3.5 h-3.5 text-blue-300" />
          <span>AttendX • UCC Attendance</span>
        </div>

        <h1 className="text-xl font-extrabold">
          {statusState === 'checking' && 'Processing QR Attendance...'}
          {statusState === 'success' &&
            (courseInfo?.course_code
              ? `Attendance marked for ${courseInfo.course_code}`
              : 'Attendance Recorded')}
          {statusState === 'error' && 'Attendance Verification Failed'}
          {statusState === 'forbidden' && 'Student Account Required'}
        </h1>

        <p className="mt-2.5 text-sm text-blue-100/90">{message}</p>

        {courseInfo && statusState === 'success' && (
          <p className="mt-2 text-xs text-blue-200/80">
            {courseInfo.course_title} • {courseInfo.venue || 'UCC Classroom'}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          {user && (
            <Link
              to={getRoleHomePath(user.role)}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-sm inline-flex items-center justify-center gap-2 transition"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          {statusState === 'error' && user?.role === 'STUDENT' && (
            <Link
              to="/student/scan"
              className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 font-semibold text-xs transition"
            >
              Open In-App QR Scanner
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default QrScanLandingPage;
