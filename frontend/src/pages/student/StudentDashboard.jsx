import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  ArrowRight,
  Calendar,
  MapPin,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/students/dashboard/')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-slate-200 rounded-2xl" />
        <div className="grid sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const sp = user?.student_profile || {};
  const activeSessions = data?.active_sessions || [];
  const courses = data?.course_summaries || [];
  const missed = data?.missed_lectures || [];
  const recent = data?.recent_history || [];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-indigo-500/20 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-mono">
              <span>{sp.index_number || 'UCC STUDENT'}</span>
              <span>•</span>
              <span>LEVEL {sp.academic_level || '300'}</span>
              <span>•</span>
              <span>{sp.programme_name || 'B.Sc. Computer Science'}</span>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                sp.verification_status === 'VERIFIED'
                  ? 'bg-blue-500/25 border-blue-300/40 text-blue-100'
                  : sp.verification_status === 'REJECTED'
                  ? 'bg-red-500/25 border-red-300/40 text-red-100'
                  : 'bg-amber-500/25 border-amber-300/40 text-amber-100'
              }`}
            >
              {sp.verification_status === 'VERIFIED'
                ? 'Verified UCC Record'
                : sp.verification_status === 'REJECTED'
                ? 'Verification Rejected'
                : 'Pending Verification'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.full_name}
          </h2>
          <p className="text-sm text-slate-300 max-w-2xl">
            {sp.department_name || 'Department of Computer Science and Information Technology'} •
            Track your real-time lecture attendance and scan classroom QR codes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/student/face-enrollment"
            className="inline-flex items-center gap-2 px-4 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white font-bold text-xs sm:text-sm transition"
          >
            <span>
              {user?.biometric_status?.enrollment_status === 'ENROLLED'
                ? 'Face ID Active'
                : 'Register My Face'}
            </span>
          </Link>
          <Link
            to="/student/scan"
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition"
          >
            <QrCode className="w-5 h-5" />
            <span>Scan Classroom QR Code</span>
          </Link>
        </div>
      </div>

      {/* Active Live Sessions Alert Banner */}
      {activeSessions.length > 0 && (
        <div className="rounded-2xl bg-emerald-950 text-emerald-50 p-5 border border-emerald-600/40 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5">
              <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Live Attendance Session In Progress
                </span>
                {activeSessions[0].already_attended && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-slate-950">
                    VERIFIED PRESENT
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">
                {activeSessions[0].course_code}: {activeSessions[0].course_title} —{' '}
                {activeSessions[0].title}
              </h3>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Venue: {activeSessions[0].venue}
              </p>
            </div>
          </div>

          <Link
            to="/student/scan"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm transition shrink-0"
          >
            <QrCode className="w-4 h-4" />
            <span>
              {activeSessions[0].already_attended ? 'View Scanner Status' : 'Scan QR Now'}
            </span>
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Overall Attendance</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">
            {data?.overall_percentage ?? 100}%
          </p>
          <p className="text-xs text-slate-500 mt-1">UCC minimum requirement: 75%</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Enrolled Courses</span>
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">
            {data?.enrolled_courses_count ?? 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">2026/2027 First Semester</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Lectures Attended</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">
            {data?.attended_sessions ?? 0}{' '}
            <span className="text-base font-medium text-slate-400">
              / {data?.total_sessions ?? 0}
            </span>
          </p>
          <p className="text-xs text-emerald-600 font-medium mt-1">Cryptographically verified</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Missed Lectures</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">
            {data?.missed_sessions ?? 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Closed sessions without scan</p>
        </div>
      </div>

      {/* Course Attendance Progress & Missed Lectures */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Course Attendance Breakdown */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Course Attendance Standing
              </h3>
              <p className="text-xs text-slate-500">
                Real-time attendance percentage across your registered UCC courses
              </p>
            </div>
            <Link
              to="/student/courses"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>All Courses</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {courses.map((c) => {
              const pct = c.attendance_percentage;
              const barColor =
                pct >= 80
                  ? 'bg-emerald-500'
                  : pct >= 75
                  ? 'bg-indigo-600'
                  : 'bg-rose-500';
              return (
                <div
                  key={c.course_id}
                  className="p-4 rounded-xl border border-slate-200/80 hover:border-indigo-200 transition space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          {c.code}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">{c.title}</h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.lecturer_name} • {c.venue}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-base font-extrabold ${
                          pct >= 75 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {pct}%
                      </span>
                      <p className="text-[11px] text-slate-400">
                        {c.attended_sessions}/{c.total_sessions} sessions
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Missed Lectures & Recent Check-ins */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Recent Verified Check-ins</h3>
              <Link
                to="/student/history"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Full History →
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">
                No attendance check-ins recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recent.slice(0, 4).map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-600">
                          {rec.course_code}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 truncate max-w-[180px]">
                          {rec.session_title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(rec.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                      {rec.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Missed Lectures ({missed.length})</span>
            </h3>
            {missed.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                Zero missed lectures! You have 100% attendance across all completed sessions.
              </div>
            ) : (
              <div className="space-y-2.5">
                {missed.slice(0, 4).map((m) => (
                  <div
                    key={m.session_id}
                    className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-rose-900">
                      <span>{m.course_code}</span>
                      <span className="font-mono text-[11px]">
                        {new Date(m.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-rose-700 mt-0.5">{m.session_title}</p>
                    <p className="text-[11px] text-rose-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {m.venue}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;

