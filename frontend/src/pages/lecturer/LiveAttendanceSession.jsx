import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  QrCode,
  Radio,
  RefreshCw,
  Maximize2,
  Minimize2,
  Copy,
  CheckCircle2,
  StopCircle,
  ShieldAlert,
  Clock,
  Wifi,
} from 'lucide-react';
import api, { getWebSocketUrl } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const LiveAttendanceSession = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSessionId = searchParams.get('session');
  const initialCourseId = searchParams.get('course');
  const initialScheduleId = searchParams.get('schedule');
  const { addToast } = useToast();

  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId || '');
  const [sessionTitle, setSessionTitle] = useState('Regular Classroom Lecture');
  const [sessionTopic, setSessionTopic] = useState('Cryptographic Verification & Systems');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [qrRefreshSeconds, setQrRefreshSeconds] = useState(60);

  const [activeSession, setActiveSession] = useState(null);
  const [qrToken, setQrToken] = useState(null);
  const [roster, setRoster] = useState([]);
  const [records, setRecords] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [projectorFullscreen, setProjectorFullscreen] = useState(false);
  const [tokenCountdown, setTokenCountdown] = useState(60);
  const [manualReason, setManualReason] = useState('Verified present in classroom by lecturer');
  const [starting, setStarting] = useState(false);

  const wsRef = useRef(null);

  const fetchSessionRecords = useCallback(async (sessId) => {
    try {
      const [sessRes, recRes] = await Promise.all([
        api.get(`/attendance/sessions/${sessId}/`),
        api.get(`/attendance/sessions/${sessId}/records/`),
      ]);
      setActiveSession(sessRes.data);
      if (sessRes.data.active_qr_token) {
        setQrToken(sessRes.data.active_qr_token);
        setTokenCountdown(sessRes.data.active_qr_token.seconds_remaining || 60);
      }
      setRoster(recRes.data.roster || []);
      setRecords(recRes.data.records || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const cRes = await api.get('/courses/?mine=true');
        setCourses(cRes.data);
        if (!selectedCourseId && cRes.data.length > 0) {
          setSelectedCourseId(cRes.data[0].id);
        }

        if (initialSessionId) {
          await fetchSessionRecords(initialSessionId);
        } else {
          const sRes = await api.get('/attendance/sessions/?status=ACTIVE');
          if (sRes.data.length > 0) {
            await fetchSessionRecords(sRes.data[0].id);
          }
        }
      } catch {
        // ignore
      }
    };
    init();
  }, [initialSessionId, fetchSessionRecords]);

  useEffect(() => {
    if (!activeSession?.id) return;

    const wsUrl = getWebSocketUrl(activeSession.id);
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setWsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'student_registered' || data.type === 'record_updated') {
          if (data.record) {
            addToast(
              `${data.record.student_name} (${data.record.student_index_number}) marked ${data.record.status}!`,
              'success',
              'Real-Time Check-In'
            );
          }
          fetchSessionRecords(activeSession.id);
        } else if (data.type === 'qr_refreshed' && data.qr_token) {
          setQrToken(data.qr_token);
          setTokenCountdown(data.qr_token.seconds_remaining || 60);
        } else if (data.type === 'verification_failed' || data.type === 'session_closed') {
          fetchSessionRecords(activeSession.id);
        }
      } catch {
        // ignore
      }
    };

    socket.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      socket.close();
    };
  }, [activeSession?.id, fetchSessionRecords, addToast]);

  const handleRotateQR = useCallback(async () => {
    if (!activeSession || activeSession.status !== 'ACTIVE') return;
    try {
      const res = await api.post(`/attendance/sessions/${activeSession.id}/generate-qr/`, {
        expiry_seconds: activeSession.qr_refresh_seconds || qrRefreshSeconds,
      });
      setQrToken(res.data.qr_token);
      setTokenCountdown(res.data.qr_token.seconds_remaining || 60);
    } catch {
      // session might have expired
    }
  }, [activeSession, qrRefreshSeconds]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'ACTIVE') return;
    const timer = setInterval(() => {
      setTokenCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeSession]);

  useEffect(() => {
    if (activeSession?.status === 'ACTIVE' && tokenCountdown === 0) {
      handleRotateQR();
    }
  }, [tokenCountdown, activeSession?.status, handleRotateQR]);

  const handleStartNewSession = async (e) => {
    e.preventDefault();
    if (!selectedCourseId) {
      addToast('Please select a course first.', 'error');
      return;
    }
    setStarting(true);
    try {
      const payload = {
        course: selectedCourseId,
        title: sessionTitle,
        topic: sessionTopic,
        duration_minutes: durationMinutes,
        qr_refresh_seconds: qrRefreshSeconds,
      };
      if (initialScheduleId) {
        payload.schedule = initialScheduleId;
      }
      const res = await api.post('/attendance/sessions/', payload);
      const sess = res.data.session;
      setActiveSession(sess);
      setQrToken(res.data.qr_token);
      setTokenCountdown(res.data.qr_token?.seconds_remaining || qrRefreshSeconds);
      setSearchParams({ session: sess.id });
      await fetchSessionRecords(sess.id);
      addToast(res.data.message, 'success', 'Classroom QR Session Live');
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not start attendance session.', 'error');
    } finally {
      setStarting(false);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;
    try {
      await api.post(`/attendance/sessions/${activeSession.id}/close/`);
      addToast('Attendance session closed. No further QR scans will be accepted.', 'info');
      fetchSessionRecords(activeSession.id);
    } catch {
      addToast('Failed to close session.', 'error');
    }
  };

  const handleManualMark = async (studentId, newStatus) => {
    if (!activeSession) return;
    try {
      const res = await api.post(`/attendance/sessions/${activeSession.id}/records/`, {
        student_id: studentId,
        status: newStatus,
        reason: manualReason || 'Manual lecturer verification',
      });
      addToast(res.data.message, 'success', 'Audit Log Recorded');
      fetchSessionRecords(activeSession.id);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not update attendance.', 'error');
    }
  };

  const copyTokenToClipboard = () => {
    if (!qrToken?.token) return;
    navigator.clipboard.writeText(qrToken.token);
    addToast('Cryptographic QR token copied! You can paste it in the Student Scanner.', 'info');
  };

  return (
    <div className="space-y-8">
      {/* Start Session Configuration Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-extrabold text-[#061430]">
              Classroom Projector QR &amp; Real-Time Attendance Monitor
            </h2>
            <p className="text-xs text-slate-500">
              Configure session duration and rotating cryptographic QR interval, then project on the
              lecture theatre screen
            </p>
          </div>
          {activeSession && (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${wsConnected
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
              >
                <Wifi className="w-3.5 h-3.5" />
                {wsConnected ? 'WebSocket Live Stream Active' : 'Polling Fallback Active'}
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleStartNewSession} className="mt-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Select Course
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:outline-none focus:border-blue-600"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Lecture Title / Week
            </label>
            <input
              type="text"
              required
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Session Duration (Mins)
            </label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:border-blue-600"
            >
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m} Minutes
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              QR Rotation TTL (Secs)
            </label>
            <select
              value={qrRefreshSeconds}
              onChange={(e) => setQrRefreshSeconds(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:border-blue-600"
            >
              {[30, 60, 120, 300].map((s) => (
                <option key={s} value={s}>
                  Every {s} Seconds
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={starting}
              className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
              }}
            >
              <QrCode className="w-4 h-4" />
              <span>{starting ? 'Starting...' : 'Start New QR Session'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Active Session Projector & Live Feed */}
      {activeSession && (
        <div
          className={`${projectorFullscreen
              ? 'fixed inset-0 z-50 bg-[#040d21] p-6 overflow-y-auto'
              : ''
            }`}
        >
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {/* Classroom Projector Screen Card — Deep Navy & Liquid Glass */}
            <div
              className="lg:col-span-5 text-white rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden"
              style={{
                background: 'linear-gradient(155deg, #040d21 0%, #07193f 55%, #051129 100%)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
                <div>
                  <span className="text-xs font-mono uppercase text-red-400 flex items-center gap-1.5 font-bold">
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    {activeSession.status === 'ACTIVE'
                      ? 'PROJECTOR QR LIVE'
                      : `SESSION ${activeSession.status}`}
                  </span>
                  <h3 className="text-lg font-extrabold mt-1 text-white">
                    {activeSession.course_code} • {activeSession.course_title}
                  </h3>
                  <p className="text-xs text-blue-200/80">
                    {activeSession.title} • {activeSession.venue}
                  </p>
                </div>

                <button
                  onClick={() => setProjectorFullscreen(!projectorFullscreen)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 cursor-pointer"
                  title="Toggle Classroom Projector Fullscreen"
                >
                  {projectorFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
              </div>

              {activeSession.status === 'ACTIVE' && qrToken ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-white p-5 rounded-2xl shadow-2xl border-4 border-blue-500/40">
                    <img
                      src={qrToken.qr_image_base64}
                      alt="AttendX Classroom QR Code"
                      className="w-64 h-64 sm:w-72 sm:h-72 object-contain"
                    />
                  </div>

                  {/* Token & Countdown Bar */}
                  <div className="w-full p-3.5 rounded-xl bg-white/8 border border-white/15 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-blue-100/80 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        <span>Next Cryptographic Rotation:</span>
                      </span>
                      <span className="font-mono font-bold text-red-400">
                        {tokenCountdown}s
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/12">
                      <code className="text-[11px] font-mono text-blue-200 truncate">
                        {qrToken.token}
                      </code>
                      <button
                        onClick={copyTokenToClipboard}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/35 hover:bg-blue-600/55 text-white border border-blue-400/30 text-[11px] font-semibold shrink-0 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy Token</span>
                      </button>
                    </div>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-3">
                    <button
                      onClick={handleRotateQR}
                      className="py-2.5 px-4 rounded-xl bg-blue-600/25 hover:bg-blue-600/40 border border-blue-400/30 text-xs font-bold text-white flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Rotate QR Now</span>
                    </button>
                    <button
                      onClick={handleCloseSession}
                      className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      <span>Close Session</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-white/8 border border-white/15 text-center space-y-3">
                  <ShieldAlert className="w-10 h-10 text-red-400 mx-auto" />
                  <h4 className="text-base font-bold text-white">
                    This Attendance Session is {activeSession.status}
                  </h4>
                  <p className="text-xs text-blue-200/80">
                    QR tokens for this session have been deactivated. You can still review or edit
                    individual student records on the right with an audit log.
                  </p>
                </div>
              )}
            </div>

            {/* Real-Time Student Verification Feed & Manual Override Roster */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#061430]">
                    Real-Time Verified Students &amp; Manual Override Roster
                  </h3>
                  <p className="text-xs text-slate-500">
                    Updates automatically via WebSockets as students scan the projected QR code
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-extrabold text-[#061430]">
                      {activeSession.present_count} / {activeSession.enrolled_count}
                    </p>
                    <p className="text-[11px] font-bold text-blue-700">
                      {activeSession.attendance_rate}% Turnout
                    </p>
                  </div>
                </div>
              </div>

              {/* Audit Reason Input for Manual Marks */}
              <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200/70 flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-xs font-bold text-[#061430] shrink-0">
                  Audit Trail Reason (for manual actions):
                </span>
                <input
                  type="text"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="Enter reason for manual attendance change..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Roster List */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Index Number</th>
                      <th className="py-3 px-4">Student, Dept &amp; Programme</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Verification &amp; Time</th>
                      <th className="py-3 px-4 text-right">Manual Override (Audit Logged)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
                    {roster.map((st) => {
                      const isPresent = st.status === 'PRESENT' || st.status === 'LATE';
                      const badgeLabel =
                        st.verification_badge ||
                        (st.verification_method === 'QR_FACE_VERIFIED' || st.biometric_verified
                          ? 'QR + Face Verified'
                          : st.verification_method === 'MANUAL'
                            ? 'Manually Verified'
                            : st.verification_method
                              ? 'QR Verified'
                              : 'Pending Verification');
                      return (
                        <tr key={st.student_id} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-blue-700">
                            {st.student_index_number}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-[#061430]">{st.student_name}</p>
                            <p className="text-[11px] text-slate-600">{st.student_programme}</p>
                            {st.student_department && (
                              <p className="text-[10px] text-slate-400">{st.student_department}</p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${st.status === 'PRESENT'
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                  : st.status === 'LATE'
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : st.status === 'EXCUSED'
                                      ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                      : 'bg-red-100 text-red-800'
                                }`}
                            >
                              {isPresent && <CheckCircle2 className="w-3 h-3" />}
                              {st.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold mb-1 ${badgeLabel.startsWith('Verified') || badgeLabel === 'QR + Face Verified'
                                  ? 'bg-blue-700 text-white'
                                  : badgeLabel === 'Verification failed'
                                    ? 'bg-red-600 text-white'
                                    : badgeLabel === 'Manually Verified'
                                      ? 'bg-slate-800 text-white'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                            >
                              {badgeLabel}
                            </span>
                            {st.timestamp && (
                              <p className="font-mono text-[11px] text-slate-500">
                                {new Date(st.timestamp).toLocaleTimeString()}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5">
                            <button
                              onClick={() => handleManualMark(st.student_id, 'PRESENT')}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
                            >
                              Present
                            </button>
                            <button
                              onClick={() => handleManualMark(st.student_id, 'LATE')}
                              className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition cursor-pointer"
                            >
                              Late
                            </button>
                            <button
                              onClick={() => handleManualMark(st.student_id, 'EXCUSED')}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                            >
                              Excused
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveAttendanceSession;
