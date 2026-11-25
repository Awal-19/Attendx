import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  UserCheck,
  Building2,
  BookOpen,
  Radio,
  ShieldCheck,
  BarChart3,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import api from '../../services/api';

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/reports/admin-overview/')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-80 bg-slate-200 rounded-2xl animate-pulse" />;
  }

  const counts = data?.counts || {};
  const depts = data?.department_analytics || [];
  const audits = data?.recent_audit_logs || [];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-amber-500/20 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-mono">
            <span>UNIVERSITY OF CAPE COAST • REGISTRAR & ICT DIRECTORATE</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            University Administration & Telemetry Console
          </h2>
          <p className="text-sm text-slate-300">
            Academic Year: <span className="font-bold text-white">{data?.current_academic_year}</span>{' '}
            • <span className="font-bold text-emerald-300">{data?.current_semester}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/admin/analytics"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm transition"
          >
            <BarChart3 className="w-4 h-4" />
            <span>University Reports</span>
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          {
            label: 'Registered Students',
            val: counts.total_students ?? 0,
            icon: GraduationCap,
            color: 'text-indigo-600',
            link: '/admin/students',
          },
          {
            label: 'Faculty Lecturers',
            val: counts.total_lecturers ?? 0,
            icon: UserCheck,
            color: 'text-emerald-600',
            link: '/admin/lecturers',
          },
          {
            label: 'Academic Courses',
            val: counts.total_courses ?? 0,
            icon: BookOpen,
            color: 'text-blue-600',
            link: '/admin/courses',
          },
          {
            label: 'Departments & Progs',
            val: `${counts.total_departments ?? 0} / ${counts.total_programmes ?? 0}`,
            icon: Building2,
            color: 'text-amber-600',
            link: '/admin/departments',
          },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              to={card.link}
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-indigo-300 transition block"
            >
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                <span>{card.label}</span>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">{card.val}</p>
              <p className="text-xs text-indigo-600 font-semibold mt-1">Manage →</p>
            </Link>
          );
        })}
      </div>

      {/* Department Analytics Chart + System Audit Trail */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            Departmental Attendance Rate Comparison (%)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={depts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="code" tick={{ fontSize: 12, fontWeight: 700 }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(val) => [`${val}%`, 'Attendance Rate']} />
                <Bar dataKey="attendance_rate" fill="#4f46e5" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Recent System & Security Audit Events</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {counts.total_records ?? 0} total check-ins
            </span>
          </div>

          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {audits.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-start justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-600">{log.action}</span>
                    <span className="font-semibold text-slate-800">{log.actor_name}</span>
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    {log.course_code ? `${log.course_code} • ` : ''}
                    {log.reason || log.new_value}
                  </p>
                </div>
                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

