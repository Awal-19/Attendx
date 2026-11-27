import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  Camera,
  CameraOff,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Radio,
  Sun,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const extractQrToken = (rawValue) => {
  const val = (rawValue || '').trim();
  if (!val) return '';
  if (val.includes('://') || val.startsWith('/')) {
    try {
      const url = new URL(val, window.location.origin);
      const qToken = url.searchParams.get('t') || url.searchParams.get('token');
      if (qToken) return qToken.trim();
      const idx = url.pathname.indexOf('/a/');
      if (idx !== -1) {
        return url.pathname.slice(idx + 3).split('/')[0].trim();
      }
    } catch {
      // fall through
    }
  }
  return val;
};

const ScanAttendance = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const autoScannedRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [verificationMeta, setVerificationMeta] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeSessions, setActiveSessions] = useState([]);

  // Step 5-8: Face Verification State
  const [faceStep, setFaceStep] = useState(null); // { token, session, liveness_instruction, allow_non_biometric_alternative }
  const [faceCameraActive, setFaceCameraActive] = useState(false);
  const [faceProgress, setFaceProgress] = useState(0);
  const [verifyingFace, setVerifyingFace] = useState(false);
  const [lastAttemptId, setLastAttemptId] = useState(null);

  const scannerRef = useRef(null);
  const faceVideoRef = useRef(null);
  const faceStreamRef = useRef(null);

  useEffect(() => {
    api
      .get('/students/dashboard/')
      .then((res) => setActiveSessions(res.data.active_sessions || []))
      .catch(() => {});
  }, [scanResult]);

  useEffect(() => {
    const initialToken = searchParams.get('t') || searchParams.get('token');
    if (initialToken && !autoScannedRef.current) {
      autoScannedRef.current = true;
      const extracted = extractQrToken(initialToken);
      setTokenInput(extracted);
      verifyAttendanceToken(extracted);
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current.clear())
          .catch(() => {});
      }
      stopFaceCamera();
    };
  }, []);

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  const stopFaceCamera = () => {
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach((t) => t.stop());
      faceStreamRef.current = null;
    }
    setFaceCameraActive(false);
  };

  const startFaceCamera = async () => {
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      faceStreamRef.current = stream;
      setFaceCameraActive(true);
      setTimeout(() => {
        if (faceVideoRef.current) {
          faceVideoRef.current.srcObject = stream;
        }
      }, 100);
    } catch {
      setFaceCameraActive(false);
      setErrorMsg(
        'Camera permission denied or no front camera detected. Please enable camera access or request manual lecturer verification.'
      );
    }
  };

  const verifyAttendanceToken = async (rawToken) => {
    const cleanToken = extractQrToken(rawToken);
    if (!cleanToken) {
      addToast('Please scan or enter a valid AttendX QR token.', 'error');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    setLastAttemptId(null);
    setScanResult(null);

    try {
      // Step 3-4: Validate QR token, expiry, session, student auth, and course registration
      const valRes = await api.post('/attendance/scan/validate-qr/', {
        token: cleanToken,
      });

      if (cameraActive) {
        await stopCamera();
      }

      if (valRes.data.requires_face_verification) {
        setFaceStep({
          token: cleanToken,
          ...valRes.data,
        });
        await startFaceCamera();
      } else if (valRes.data.face_registration_required) {
        setErrorMsg(
          'Facial registration required: Please complete "Register My Face" before scanning QR attendance, or request the non-biometric manual alternative.'
        );
        setFaceStep({
          token: cleanToken,
          unregistered: true,
          ...valRes.data,
        });
      } else {
        // Student opted out -> allow non-biometric alternative request
        const res = await api.post('/attendance/scan/', {
          token: cleanToken,
          use_alternative: true,
          device_info: navigator.userAgent,
        });
        addToast(res.data.message, 'info', 'Manual Verification Requested');
        setTokenInput('');
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        'QR verification failed. The code may be expired or invalid.';
      setErrorMsg(msg);
      addToast(msg, 'error', 'Verification Rejected');
    } finally {
      setSubmitting(false);
    }
  };

  const captureFaceFrame = () => {
    const video = faceVideoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.88);
  };

  const handleCaptureAndVerifyFace = async () => {
    if (!faceStep?.token) return;
    setVerifyingFace(true);
    setErrorMsg('');
    setLastAttemptId(null);
    setFaceProgress(15);

    try {
      const frames = [];
      for (let i = 0; i < 3; i += 1) {
        const frame = captureFaceFrame();
        if (frame) frames.push(frame);
        setFaceProgress(25 + (i + 1) * 20);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 400));
      }

      setFaceProgress(90);
      const res = await api.post('/attendance/scan/', {
        token: faceStep.token,
        frames,
        challenge: faceStep.liveness_challenge || 'HEAD_TURN',
        device_info: navigator.userAgent,
      });

      setFaceProgress(100);
      setScanResult(res.data.record);
      setVerificationMeta(res.data.student_verification);
      setFaceStep(null);
      setTokenInput('');
      stopFaceCamera();
      addToast(res.data.message, 'success', 'Identity & Attendance Verified!');
    } catch (err) {
      const data = err.response?.data || {};
      const msg =
        data.error || 'Facial verification failed. Please adjust lighting and try again.';
      setErrorMsg(msg);
      if (data.attempt_id) {
        setLastAttemptId(data.attempt_id);
      }
      addToast(msg, 'error', 'Verification Unsuccessful');
    } finally {
      setVerifyingFace(false);
    }
  };

  const handleRequestAlternativeOrDispute = async () => {
    if (lastAttemptId) {
      try {
        await api.post(`/biometrics/dispute/${lastAttemptId}/`, {
          notes: 'Student requested manual lecturer verification after face check failure.',
        });
        addToast('Manual verification dispute sent to lecturer & admin.', 'info');
        setFaceStep(null);
        stopFaceCamera();
      } catch {
        addToast('Could not submit verification dispute.', 'error');
      }
      return;
    }

    if (faceStep?.token) {
      try {
        const res = await api.post('/attendance/scan/', {
          token: faceStep.token,
          use_alternative: true,
        });
        addToast(res.data.message, 'info', 'Manual Verification Requested');
        setFaceStep(null);
        stopFaceCamera();
      } catch (err) {
        addToast(err.response?.data?.error || 'Could not request alternative.', 'error');
      }
    }
  };

  const startCamera = async () => {
    setErrorMsg('');
    setScanResult(null);
    setCameraActive(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode('attendx-qr-reader');
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            verifyAttendanceToken(decodedText);
          },
          () => {}
        );
      } catch {
        setCameraActive(false);
        setErrorMsg(
          'Camera permission was denied or no camera device was detected. You can paste or enter the classroom QR token directly below.'
        );
      }
    }, 150);
  };

  const isBiometricEnrolled = user?.biometric_status?.enrollment_status === 'ENROLLED';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-[#061430]">
          Classroom QR &amp; Facial Attendance Scanner
        </h2>
        <p className="text-sm text-slate-500">
          Scan the lecturer’s rotating QR code and complete 1:1 facial verification
        </p>
      </div>

      {/* Authenticated Student Security Badge */}
      <div
        className="p-4 rounded-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #040d21 0%, #0a1f4e 65%, #991b1b 100%)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/25 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <p className="text-xs text-blue-200/80">Authenticated Student Identity (Locked)</p>
            <p className="text-sm font-bold">
              {user?.full_name} •{' '}
              <span className="font-mono text-blue-200">
                {user?.student_profile?.index_number || 'UCC STUDENT'}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isBiometricEnrolled ? (
            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-blue-500/25 text-white border border-blue-300/40">
              Face ID Active
            </span>
          ) : (
            <Link
              to="/student/face-enrollment"
              className="text-[11px] font-bold px-3 py-1 rounded-full bg-red-600/80 hover:bg-red-500 text-white border border-white/30 transition"
            >
              Enroll Face ID →
            </Link>
          )}
        </div>
      </div>

      {/* Active Sessions Indicator */}
      {activeSessions.length > 0 && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-red-600 animate-pulse shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase text-blue-900">
                Active Lecture Session Detected for Your Course
              </p>
              <p className="text-sm font-semibold text-[#061430]">
                {activeSessions[0].course_code} — {activeSessions[0].title} (
                {activeSessions[0].venue})
              </p>
            </div>
          </div>
          {activeSessions[0].already_attended && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-700 text-white">
              Already Marked Present
            </span>
          )}
        </div>
      )}

      {/* Confirmation Card */}
      {scanResult && (
        <div
          className="p-6 rounded-3xl text-white shadow-2xl space-y-4"
          style={{
            background: 'linear-gradient(135deg, #040d21 0%, #1d4ed8 65%, #991b1b 100%)',
            border: '1px solid rgba(255, 255, 255, 0.28)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-blue-200">
                FACIAL VERIFICATION SUCCESSFUL
              </span>
              <h3 className="text-xl font-extrabold">
                Attendance successfully recorded! Your identity has been verified.
              </h3>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-[#040d21]/60 border border-white/15 text-xs">
            <div>
              <p className="text-blue-200/75">Course</p>
              <p className="font-bold text-white mt-0.5">
                {scanResult.course_code} — {scanResult.course_title}
              </p>
            </div>
            <div>
              <p className="text-blue-200/75">Student &amp; Index</p>
              <p className="font-bold text-white mt-0.5">
                {scanResult.student_name} ({scanResult.student_index_number})
              </p>
            </div>
            <div>
              <p className="text-blue-200/75">Date &amp; Time</p>
              <p className="font-mono text-white mt-0.5">
                {new Date(scanResult.timestamp).toLocaleDateString()} •{' '}
                {new Date(scanResult.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <div>
              <p className="text-blue-200/75">Status</p>
              <p className="font-bold text-blue-200 mt-0.5">
                {scanResult.status} ({verificationMeta?.biometric_verified ? 'QR + Face Verified' : scanResult.verification_method})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Verification Unsuccessful</p>
            <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
            {(lastAttemptId || faceStep) && (
              <button
                onClick={handleRequestAlternativeOrDispute}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
              >
                Request Manual Lecturer Verification
              </button>
            )}
          </div>
        </div>
      )}

      {/* Liquid Glass Step 5-8: "Verify Your Identity" Camera Frame */}
      {faceStep ? (
        <div
          className="relative rounded-3xl p-6 sm:p-8 text-white shadow-2xl space-y-5 overflow-hidden"
          style={{
            background:
              'linear-gradient(145deg, rgba(4, 13, 33, 0.94) 0%, rgba(15, 34, 78, 0.92) 60%, rgba(153, 27, 27, 0.85) 100%)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
          }}
        >
          <div
            className="absolute top-0 inset-x-0 h-[2px]"
            style={{
              background:
                'linear-gradient(90deg, transparent 5%, rgba(96, 165, 250, 0.9) 30%, rgba(255, 255, 255, 0.95) 50%, rgba(248, 113, 113, 0.9) 70%, transparent 95%)',
            }}
          />

          <div className="text-center space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold uppercase tracking-wider text-blue-200">
              {faceStep.session?.course_code} • QR Token Verified
            </span>
            <h3 className="text-2xl font-extrabold tracking-tight text-white">
              Verify Your Identity
            </h3>
            <p className="text-sm text-blue-100/90 font-medium">
              Position your face inside the frame.
            </p>
            <p className="text-xs text-red-200 font-semibold">
              Liveness Prompt: {faceStep.liveness_instruction}
            </p>
          </div>

          {faceCameraActive ? (
            <div className="space-y-4">
              <div className="relative max-w-md mx-auto rounded-3xl overflow-hidden bg-[#040d21] border-2 border-white/30 shadow-2xl">
                <video
                  ref={faceVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-72 object-cover scale-x-[-1]"
                />
                {/* Oval Face Positioning Guide */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className="w-44 h-56 rounded-full border-2 border-dashed border-white/90"
                    style={{
                      boxShadow: '0 0 0 9999px rgba(4, 13, 33, 0.45)',
                    }}
                  />
                </div>
                <div className="absolute bottom-3 inset-x-3 px-3 py-1.5 rounded-xl bg-[#040d21]/75 backdrop-blur-md border border-white/20 text-white text-[11px] flex items-center justify-center gap-2">
                  <Sun className="w-3.5 h-3.5 text-amber-300" />
                  <span>Ensure even lighting &amp; follow the head-turn prompt</span>
                </div>
              </div>

              {verifyingFace && (
                <div className="max-w-md mx-auto space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-white">
                    <span>Running liveness &amp; 1:1 facial match...</span>
                    <span>{faceProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/15 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${faceProgress}%`,
                        background: 'linear-gradient(90deg, #60a5fa, #ffffff, #f87171)',
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleCaptureAndVerifyFace}
                  disabled={verifyingFace}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm shadow-xl cursor-pointer disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #dc2626 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.35)',
                  }}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{verifyingFace ? 'Verifying Identity...' : 'Capture & Verify Identity'}</span>
                </button>

                <button
                  onClick={() => {
                    setFaceStep(null);
                    stopFaceCamera();
                  }}
                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 space-y-3">
              <button
                onClick={startFaceCamera}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Camera Access</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Step 1-2: Optical QR Scanner & Token Input */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Camera className="w-5 h-5 text-blue-700" />
              <h3 className="text-base font-extrabold text-[#061430]">
                Optical Camera QR Scanner
              </h3>
            </div>
            {cameraActive ? (
              <button
                onClick={stopCamera}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition cursor-pointer"
              >
                <CameraOff className="w-4 h-4" />
                <span>Stop Camera</span>
              </button>
            ) : (
              <button
                onClick={startCamera}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold transition cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
                }}
              >
                <Camera className="w-4 h-4" />
                <span>Launch Camera Scanner</span>
              </button>
            )}
          </div>

          {cameraActive ? (
            <div className="rounded-2xl overflow-hidden bg-[#040d21] border-2 border-blue-600 max-w-md mx-auto">
              <div id="attendx-qr-reader" className="w-full" />
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3 bg-slate-50/60">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
                <QrCode className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-[#061430]">
                Ready to Scan Classroom Projector QR Code
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click &ldquo;Launch Camera Scanner&rdquo; above to scan with your device camera, or
                paste the cryptographic QR token string below.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyAttendanceToken(tokenInput);
              }}
              className="space-y-3"
            >
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Cryptographic QR Token Verification
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Paste or enter classroom token (e.g. ATX.xxxxxx.xxxxxx)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 font-mono text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#061430] hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold transition cursor-pointer shrink-0"
                >
                  {submitting ? 'Validating QR...' : 'Verify Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanAttendance;
