import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Users,
  Radio,
  BarChart3,
  QrCode,
  ArrowRight,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const LecturerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/lecturers/dashboard/')
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

  const lp = user?.lecturer_profile || {};
  const activeSessions = data?.active_sessions || [];
  const courses = data?.courses || [];
  const breakdown = data?.course_breakdown || [];
  const recentSessions = data?.recent_sessions || [];

  return (
    <div className="space-y-8">
      {/* Header Banner — Deep Navy, Royal Blue & UCC Crimson Red Liquid Glass */}
      <div
        className="relative rounded-3xl text-white p-6 sm:p-8 shadow-2xl overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6"
        style={{
          background:
            'linear-gradient(135deg, #040d21 0%, #0a1f4e 52%, #1d4ed8 84%, #991b1b 100%)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          boxShadow:
            '0 24px 48px -12px rgba(4, 13, 33, 0.45), inset 0 1px 0 0 rgba(255, 255, 255, 0.28)',
        }}
      >
        {/* Top Specular Blue-White-Red Rim Highlight */}
        <div
          className="absolute top-0 inset-x-0 h-[2px]"
          style={{
            background:
              'linear-gradient(90deg, transparent 5%, rgba(96, 165, 250, 0.85) 30%, rgba(255, 255, 255, 0.95) 50%, rgba(248, 113, 113, 0.85) 70%, transparent 95%)',
          }}
        />
        {/* Ambient Crimson Red Glow */}
        <div
          className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(220, 38, 38, 0.35) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        <div className="relative z-10 space-y-2.5">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-white text-xs font-mono font-semibold"
            style={{
              background:
                'linear-gradient(90deg, rgba(37, 99, 235, 0.42) 0%, rgba(220, 38, 38, 0.38) 100%)',
              backdropFilter: 'blur(14px)',
              border: '1px solid rgba(255, 255, 255, 0.28)',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span>{lp.staff_id || 'UCC FACULTY'}</span>
            <span className="text-blue-200">•</span>
            <span>{lp.department_name || 'University of Cape Coast'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {lp.title || 'Dr.'} {user?.full_name}
          </h2>
          <p className="text-sm text-blue-100/90 max-w-2xl leading-relaxed">
            Project rotating cryptographic QR codes in class, monitor students registering in real
            time via WebSockets, and export official UCC attendance reports.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <Link
            to="/lecturer/live-session"
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-white font-extrabold text-sm transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #dc2626 100%)',
              border: '1px solid rgba(255, 255, 255, 0.42)',
              boxShadow:
                '0 14px 30px -6px rgba(2, 6, 23, 0.55), 0 0 24px -4px rgba(220, 38, 38, 0.45), inset 0 1px 0 0 rgba(255, 255, 255, 0.45)',
            }}
          >
            <QrCode className="w-5 h-5" />
            <span>Start / Project Classroom QR</span>
          </Link>
        </div>
      </div>

      {/* Live Session Banner */}
      {activeSessions.length > 0 && (
        <div
          className="rounded-2xl text-white p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{
            background: 'linear-gradient(135deg, #061430 0%, #1e3a8a 60%, #991b1b 100%)',
            border: '1px solid rgba(147, 197, 253, 0.35)',
          }}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/25 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5 text-red-400 animate-ping" />
            </div>
            <div>
              <span className="text-xs font-mono uppercase text-red-300 font-bold tracking-wider">
                ACTIVE CLASSROOM QR SESSION RUNNING
              </span>
              <h3 className="text-base font-bold mt-0.5 text-white">
                {activeSessions[0].course_code}: {activeSessions[0].title}
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">
                {activeSessions[0].present_count} / {activeSessions[0].enrolled_count} students
                checked in ({activeSessions[0].attendance_rate}%)
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/lecturer/live-session?session=${activeSessions[0].id}`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#061430] font-bold text-xs sm:text-sm hover:bg-blue-50 transition cursor-pointer shrink-0 shadow-md"
          >
            <span>Open Live Projector &amp; Monitor</span>
            <ArrowRight className="w-4 h-4 text-red-600" />
          </button>
        </div>
      )}

      {/* KPI Metrics — Royal Blue, Navy & UCC Red Accents */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="relative bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-700 to-blue-500" />
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Assigned Courses</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#061430] mt-2">
            {data?.total_courses ?? 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Active this semester</p>
        </div>

        <div className="relative bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-600 to-red-600" />
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Enrolled Students</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-red-600" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#061430] mt-2">
            {data?.total_students ?? 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Distinct students across courses</p>
        </div>

        <div className="relative bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-800 to-blue-600" />
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Sessions Conducted</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#061430] mt-2">
            {data?.total_sessions ?? 0}
          </p>
          <p className="text-xs text-red-600 font-bold mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
            <span>{data?.active_sessions_count ?? 0} currently live</span>
          </p>
        </div>

        <div className="relative bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-600 to-blue-700" />
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Avg Attendance Rate</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#061430] mt-2">
            {data?.average_attendance_rate ?? 0}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {data?.present_count ?? 0} present • {data?.absent_count ?? 0} absent •{' '}
            <span className="text-red-600 font-semibold">
              {data?.low_attendance_count ?? 0} low attendance
            </span>
          </p>
        </div>
      </div>

      {/* Weekly, Monthly & Present-vs-Absent Overview Charts */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-3">
          <h3 className="text-base font-extrabold text-[#061430]">Attendance Overview</h3>
          <p className="text-xs text-slate-500">Present vs Absent across assigned courses</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.present_vs_absent || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={76}
                  paddingAngle={4}
                >
                  <Cell fill="#1d4ed8" />
                  <Cell fill="#dc2626" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 text-xs font-bold">
            <span className="text-blue-700">Present: {data?.present_count ?? 0}</span>
            <span className="text-red-600">Absent: {data?.absent_count ?? 0}</span>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-3">
          <h3 className="text-base font-extrabold text-[#061430]">Weekly Attendance Trends</h3>
          <p className="text-xs text-slate-500">Attendance rate across weeks</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.weekly_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val) => [`${val}%`, 'Weekly Rate']} />
                <Area type="monotone" dataKey="rate" stroke="#1d4ed8" fill="#bfdbfe" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-3">
          <h3 className="text-base font-extrabold text-[#061430]">Monthly Attendance Trends</h3>
          <p className="text-xs text-slate-500">Attendance comparison across months</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.monthly_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val) => [`${val}%`, 'Monthly Rate']} />
                <Bar dataKey="rate" fill="#dc2626" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Course Chart + Assigned Courses */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-[#061430]">
                Course Attendance Performance
              </h3>
              <p className="text-xs text-slate-500">Average attendance percentage per course</p>
            </div>
            <Link
              to="/lecturer/reports"
              className="text-xs font-bold text-blue-700 hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export PDF / Excel</span>
            </Link>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdown}>
                <defs>
                  <linearGradient id="uccBlueRedBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1d4ed8" />
                    <stop offset="75%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="code" tick={{ fontSize: 12, fontWeight: 600, fill: '#0f172a' }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip formatter={(val) => [`${val}%`, 'Avg Attendance']} />
                <Bar dataKey="average_attendance" fill="url(#uccBlueRedBar)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-[#061430]">My Assigned Courses</h3>
              <p className="text-xs text-slate-500">
                Select a course to view enrolled students or launch QR attendance
              </p>
            </div>
            <Link
              to="/lecturer/courses"
              className="text-xs font-bold text-blue-700 hover:text-red-600 transition-colors"
            >
              Manage Courses →
            </Link>
          </div>

          <div className="space-y-3">
            {courses.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl border border-slate-200/80 hover:border-blue-400 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200/70">
                      {c.code}
                    </span>
                    <h4 className="text-sm font-bold text-[#061430]">{c.title}</h4>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {c.enrolled_count} Enrolled Students • {c.sessions_count} Sessions • {c.venue}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/lecturer/courses/${c.id}`}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
                  >
                    Roster
                  </Link>
                  <Link
                    to={`/lecturer/live-session?course=${c.id}`}
                    className="px-3.5 py-1.5 rounded-lg text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs hover:opacity-95"
                    style={{
                      background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 65%, #dc2626 100%)',
                    }}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Start QR</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Attendance Sessions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-[#061430]">Recent Lecture Sessions</h3>
          <Link
            to="/lecturer/history"
            className="text-xs font-bold text-blue-700 hover:text-red-600 transition-colors"
          >
            View All Sessions →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Course</th>
                <th className="py-3 px-4">Session Title</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Turnout</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 text-xs sm:text-sm">
              {recentSessions.map((sess) => (
                <tr key={sess.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-blue-700">
                    {sess.course_code}
                  </td>
                  <td className="py-3 px-4 font-semibold text-[#061430]">{sess.title}</td>
                  <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                    {new Date(sess.start_time).toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-[#061430]">
                      {sess.present_count}/{sess.enrolled_count}
                    </span>{' '}
                    <span className="text-xs text-slate-500">({sess.attendance_rate}%)</span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        sess.status === 'ACTIVE'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-blue-50 text-blue-800 border border-blue-200/60'
                      }`}
                    >
                      {sess.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      to={`/lecturer/live-session?session=${sess.id}`}
                      className="text-xs font-bold text-blue-700 hover:text-red-600 transition-colors"
                    >
                      {sess.status === 'ACTIVE' ? 'Project QR & Monitor →' : 'Inspect / Edit →'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LecturerDashboard;
