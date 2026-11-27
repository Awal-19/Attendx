import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  QrCode,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getRoleHomePath } from '../../components/common/ProtectedRoute';
import { isInAppBrowser } from '../../utils/browserDetect';

const QrScanLandingPage = () => {
  const { token: paramToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = (paramToken || searchParams.get('t') || searchParams.get('token') || '').trim();

  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const submittedRef = useRef(false);

  const [inApp] = useState(() => isInAppBrowser());
  const [copied, setCopied] = useState(false);
  const [statusState, setStatusState] = useState('checking'); // checking | already_marked | error | forbidden
  const [message, setMessage] = useState('Verifying attendance QR code...');
  const [meta, setMeta] = useState(null);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  useEffect(() => {
    if (inApp || loading) return;

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
        if (valRes.data.face_registration_required) {
          const nextScan = `/student/scan?t=${encodeURIComponent(token)}`;
          navigate(`/student/face-enrollment?next=${encodeURIComponent(nextScan)}`, {
            replace: true,
          });
          return;
        }
        navigate(`/student/scan?t=${encodeURIComponent(token)}`, { replace: true });
      } catch (err) {
        const data = err.response?.data || {};
        if (data.already_marked) {
          setStatusState('already_marked');
          setMeta(data);
          setMessage(data.error || "You're already marked present.");
        } else {
          setStatusState('error');
          setMessage(
            data.error ||
              'Could not verify QR code. It may have expired or the session has ended.'
          );
        }
      }
    })();
  }, [inApp, loading, user, token, navigate]);

  if (inApp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#061430] px-4 py-10 text-white">
        <div className="w-full max-w-md rounded-3xl bg-white/10 border border-white/20 backdrop-blur-xl p-6 sm:p-8 text-center shadow-2xl space-y-5">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-amber-500/20 border border-amber-300/40">
            <ExternalLink className="w-7 h-7 text-amber-300" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold">
            Open this page in Safari/Chrome to verify your face
          </h1>
          <p className="text-sm text-blue-100/90">
            In-app browsers (WhatsApp, TikTok, Instagram, Facebook) often block camera access.
            Copy the link below and open it in Safari or Chrome.
          </p>
          <button
            onClick={handleCopyLink}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-sm inline-flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Link Copied!' : 'Copy link'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#061430] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-3xl bg-white/10 border border-white/20 backdrop-blur-xl p-6 sm:p-8 text-center shadow-2xl">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-white/10 border border-white/20">
          {statusState === 'checking' && (
            <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {statusState === 'already_marked' && (
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          )}
          {statusState === 'error' && <AlertCircle className="w-7 h-7 text-red-400" />}
          {statusState === 'forbidden' && <ShieldAlert className="w-7 h-7 text-amber-400" />}
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold uppercase tracking-wider mb-3">
          <QrCode className="w-3.5 h-3.5 text-blue-300" />
          <span>AttendX • UCC Attendance</span>
        </div>

        <h1 className="text-xl font-extrabold">
          {statusState === 'checking' && 'Processing QR Attendance...'}
          {statusState === 'already_marked' &&
            (meta?.course_code
              ? `Already Marked Present (${meta.course_code})`
              : "You're already marked present")}
          {statusState === 'error' && 'Attendance Verification Failed'}
          {statusState === 'forbidden' && 'Student Account Required'}
        </h1>

        <p className="mt-2.5 text-sm text-blue-100/90">{message}</p>

        {meta && statusState === 'already_marked' && (
          <div className="mt-4 p-3.5 rounded-2xl bg-white/10 border border-white/15 text-xs space-y-1 text-left">
            <p>
              <span className="text-blue-200">Course:</span> {meta.course_code} — {meta.course_title}
            </p>
            <p>
              <span className="text-blue-200">Student:</span> {meta.student_name} (
              {meta.student_index_number})
            </p>
            <p>
              <span className="text-blue-200">Time:</span> {meta.marked_time}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          {user && (
            <Link
              to={getRoleHomePath(user.role)}
              className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-sm inline-flex items-center justify-center gap-2 transition"
            >
              <span>Go to dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          {statusState === 'error' && user?.role === 'STUDENT' && (
            <Link
              to="/student/scan"
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 font-semibold text-xs inline-flex items-center justify-center transition"
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
