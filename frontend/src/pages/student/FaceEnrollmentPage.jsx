import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Lock,
  Trash2,
  Sparkles,
  Sun,
  UserCheck,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { isInAppBrowser } from '../../utils/browserDetect';

const POSE_PROMPTS = [
  'Frame 1/3: Look straight at the camera',
  'Frame 2/3: Turn your head slightly left',
  'Frame 3/3: Turn your head slightly right',
];

const FaceEnrollmentPage = () => {
  const { user, refreshProfile } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawNext = searchParams.get('next') || '';
  const safeNext = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '';

  const [inApp] = useState(() => isInAppBrowser());
  const [copiedLink, setCopiedLink] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [posePrompt, setPosePrompt] = useState('');
  const [progress, setProgress] = useState(0);
  const [enrollResult, setEnrollResult] = useState(null);
  const [consentChecked, setConsentChecked] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const loadStatus = async () => {
    try {
      const res = await api.get('/biometrics/status/');
      setStatusData(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError('');
    setEnrollResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch {
      setCameraError(
        'Camera permission denied or no front camera detected. Please allow camera access in your browser settings.'
      );
    }
  };

  const handleConsentAction = async (action) => {
    try {
      const res = await api.post('/biometrics/consent/', { action });
      addToast(res.data.message, action === 'CONSENT' ? 'success' : 'info');
      await Promise.all([loadStatus(), refreshProfile()]);
      if (action !== 'CONSENT') {
        stopCamera();
      }
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not update biometric consent.', 'error');
    }
  };

  const captureFrameBase64 = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.88);
  };

  const handleCaptureAndEnroll = async () => {
    if (!videoRef.current) return;
    setCapturing(true);
    setProgress(15);
    setCameraError('');

    try {
      const frames = [];
      for (let i = 0; i < 3; i += 1) {
        setPosePrompt(POSE_PROMPTS[i]);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, i === 0 ? 350 : 650));
        const frame = captureFrameBase64();
        if (frame) frames.push(frame);
        setProgress(25 + (i + 1) * 20);
      }

      setPosePrompt('Encrypting facial template...');
      setProgress(90);
      const res = await api.post('/biometrics/enroll/', { frames });
      setProgress(100);
      setEnrollResult(res.data);
      addToast(res.data.message, 'success', 'Biometric Enrollment Complete');
      stopCamera();
      await Promise.all([loadStatus(), refreshProfile()]);
      if (safeNext) {
        setTimeout(() => navigate(safeNext, { replace: true }), 900);
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        'Face enrollment failed. Ensure good lighting and position your face inside the guide.';
      setCameraError(msg);
      addToast(msg, 'error', 'Enrollment Failed');
    } finally {
      setCapturing(false);
    }
  };

  if (loading) {
    return <div className="h-64 bg-slate-200 rounded-3xl animate-pulse max-w-3xl mx-auto" />;
  }

  const sp = user?.student_profile || {};
  const isEnrolled = statusData?.enrollment_status === 'ENROLLED';
  const hasConsent = statusData?.has_active_consent;
  const optedOut = statusData?.enrollment_status === 'OPTED_OUT';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Liquid Glass Header */}
      <div
        className="relative rounded-3xl p-6 sm:p-8 text-white overflow-hidden shadow-2xl"
        style={{
          background:
            'linear-gradient(135deg, #040d21 0%, #0a1f4e 55%, #1d4ed8 85%, #991b1b 100%)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
        }}
      >
        <div
          className="absolute top-0 inset-x-0 h-[2px]"
          style={{
            background:
              'linear-gradient(90deg, transparent 5%, rgba(96, 165, 250, 0.85) 30%, rgba(255, 255, 255, 0.95) 50%, rgba(248, 113, 113, 0.85) 70%, transparent 95%)',
          }}
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold uppercase tracking-wider mb-2">
              <Lock className="w-3.5 h-3.5 text-blue-300" />
              <span>Encrypted 1:1 Biometric Identity</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              Student Facial Biometric Enrollment
            </h2>
            <p className="text-xs sm:text-sm text-blue-100/85 mt-1">
              {user?.full_name} • <span className="font-mono">{sp.index_number}</span>
            </p>
          </div>
          <span
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border self-start sm:self-center ${
              isEnrolled
                ? 'bg-blue-500/25 border-blue-300/40 text-white'
                : optedOut
                ? 'bg-amber-500/25 border-amber-300/40 text-amber-100'
                : 'bg-red-500/25 border-red-300/40 text-red-100'
            }`}
          >
            {statusData?.enrollment_status || 'NOT_ENROLLED'}
          </span>
        </div>
      </div>

      {/* Step 1: Informed Consent / Opt-Out */}
      {!hasConsent && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 text-[#061430]">
            <ShieldCheck className="w-5 h-5 text-blue-700" />
            <h3 className="text-base font-extrabold">
              Informed Biometric Consent &amp; Privacy Notice
            </h3>
          </div>
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/70 text-xs text-slate-700 space-y-2 leading-relaxed">
            <p>
              • <strong>Purpose:</strong> Your facial biometric template is used strictly for 1:1
              identity verification during classroom QR attendance check-ins.
            </p>
            <p>
              • <strong>Security &amp; Zero Raw Photo Storage:</strong> AttendX extracts a
              mathematical 128-D embedding, encrypts it at rest using AES encryption, and discards
              raw camera frames immediately.
            </p>
            <p>
              • <strong>Retention &amp; Rights:</strong> Templates are retained for{' '}
              <strong>{statusData?.retention_days || 365} days</strong> and can be revoked/deleted
              by you at any time.
            </p>
            <p>
              • <strong>Non-Biometric Alternative:</strong> If you decline, you may select the
              non-biometric alternative and verify attendance in person with your lecturer.
            </p>
          </div>

          <label className="flex items-start gap-2.5 text-xs font-semibold text-[#061430] cursor-pointer">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded accent-blue-700"
            />
            <span>
              I have read and give explicit informed consent for AttendX to process and store my
              encrypted facial template for classroom attendance verification.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={!consentChecked}
              onClick={() => handleConsentAction('CONSENT')}
              className="px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold disabled:opacity-50 cursor-pointer transition"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
              }}
            >
              Give Consent &amp; Continue to Camera
            </button>

            {statusData?.allow_non_biometric_alternative && (
              <button
                type="button"
                onClick={() => handleConsentAction('OPT_OUT')}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold cursor-pointer transition"
              >
                Decline &amp; Use Non-Biometric Alternative
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Live Camera Enrollment */}
      {hasConsent && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[#061430]">
                {isEnrolled ? 'Update Facial Biometric Template' : 'Capture Facial Template'}
              </h3>
              <p className="text-xs text-slate-500">
                Position your face inside the oval guide in a well-lit area.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isEnrolled ? (
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                  Locked (1 Enrollment / Account)
                </span>
              ) : !cameraActive ? (
                <button
                  onClick={startCamera}
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl text-white text-xs font-bold cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
                  }}
                >
                  <Camera className="w-4 h-4" />
                  <span>Open Camera</span>
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold cursor-pointer"
                >
                  <CameraOff className="w-4 h-4" />
                  <span>Stop Camera</span>
                </button>
              )}
            </div>
          </div>

          {cameraError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}

          {enrollResult && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-[#061430] flex items-center gap-3 text-xs">
              <CheckCircle2 className="w-5 h-5 text-blue-700 shrink-0" />
              <div>
                <p className="font-bold">Biometric Template Enrolled &amp; Encrypted</p>
                <p className="text-slate-600">
                  Quality Score: {enrollResult.quality_score} • Accepted Frames:{' '}
                  {enrollResult.frames_accepted}
                </p>
              </div>
            </div>
          )}

          {cameraActive && (
            <div className="space-y-4">
              <div className="relative max-w-md mx-auto rounded-3xl overflow-hidden bg-[#040d21] border-2 border-blue-500/60 shadow-2xl">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-72 object-cover scale-x-[-1]"
                />
                {/* Oval Face Positioning Guide */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className="w-44 h-56 rounded-full border-2 border-dashed border-white/85"
                    style={{
                      boxShadow: '0 0 0 9999px rgba(4, 13, 33, 0.42)',
                    }}
                  />
                </div>
                <div className="absolute bottom-3 inset-x-3 px-3 py-1.5 rounded-xl bg-[#040d21]/75 backdrop-blur-md border border-white/20 text-white text-[11px] flex items-center justify-center gap-2">
                  <Sun className="w-3.5 h-3.5 text-amber-300" />
                  <span>Keep your face centered with even front lighting</span>
                </div>
              </div>

              {capturing && (
                <div className="max-w-md mx-auto space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-[#061430]">
                    <span>{posePrompt || 'Analyzing face quality & encrypting template...'}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, #1d4ed8, #dc2626)',
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                <button
                  onClick={handleCaptureAndEnroll}
                  disabled={capturing}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm shadow-lg cursor-pointer disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
                  }}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{capturing ? 'Enrolling Face...' : 'Capture & Enroll Face'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Revoke & Delete Biometric Data Option */}
          {isEnrolled && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Enrolled on {new Date(statusData.enrolled_at).toLocaleDateString()} • Expires{' '}
                {statusData.expires_at
                  ? new Date(statusData.expires_at).toLocaleDateString()
                  : 'in 1 year'}
              </span>
              <button
                onClick={() => handleConsentAction('REVOKE')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 font-bold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Revoke &amp; Delete Template</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FaceEnrollmentPage;

