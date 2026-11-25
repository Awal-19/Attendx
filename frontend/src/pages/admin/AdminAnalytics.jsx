import React, { useState, useEffect, useCallback } from 'react';
import { FileText, FileSpreadsheet, Download, Award, AlertTriangle } from 'lucide-react';
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
import { useToast } from '../../context/ToastContext';

const AdminAnalytics = () => {
  const [report, setReport] = useState(null);
  const [overview, setOverview] = useState(null);
  const [years, setYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [coursesList, setCoursesList] = useState([]);

  const [yearId, setYearId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [deptId, setDeptId] = useState('');
  const [progId, setProgId] = useState('');
  const [courseId, setCourseId] = useState('');

  const { addToast } = useToast();

  useEffect(() => {
    Promise.all([
      api.get('/academics/academic-years/'),
      api.get('/academics/semesters/'),
      api.get('/academics/departments/'),
      api.get('/academics/programmes/'),
      api.get('/courses/'),
    ])
      .then(([yRes, sRes, dRes, pRes, cRes]) => {
        setYears(yRes.data);
        setSemesters(sRes.data);
        setDepartments(dRes.data);
        setProgrammes(pRes.data);
        setCoursesList(cRes.data);
      })
      .catch(() => {});
  }, []);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (yearId) params.append('academic_year', yearId);
    if (semesterId) params.append('semester', semesterId);
    if (deptId) params.append('department', deptId);
    if (progId) params.append('programme', progId);
    if (courseId) params.append('course', courseId);
    return params.toString() ? `?${params.toString()}` : '';
  }, [yearId, semesterId, deptId, progId, courseId]);

  useEffect(() => {
    const qs = buildQuery();
    Promise.all([
      api.get(`/reports/attendance/${qs}`),
      api.get(`/reports/admin-overview/${qs}`),
    ])
      .then(([repRes, ovRes]) => {
        setReport(repRes.data);
        setOverview(ovRes.data);
      })
      .catch(() => {});
  }, [buildQuery]);

  const handleExport = async (type) => {
    try {
      const qs = buildQuery();
      const url =
        type === 'pdf'
          ? `/reports/attendance/pdf/${qs}`
          : type === 'csv'
          ? `/reports/attendance/csv/${qs}`
          : `/reports/attendance/excel/${qs}`;
      const res = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      const ext = type === 'pdf' ? 'pdf' : type === 'csv' ? 'csv' : 'xlsx';
      link.setAttribute('download', `AttendX_UCC_University_Wide_Report.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      addToast(`University-wide ${type.toUpperCase()} report downloaded!`, 'success');
    } catch {
      addToast('Failed to export report.', 'error');
    }
  };

  const courses = report?.course_analytics || [];
  const counts = overview?.counts || {};
  const depts = overview?.department_analytics || [];
  const progs = overview?.programme_analytics || [];
  const trends = overview?.monthly_trends || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#061430]">
            University-Wide Attendance Analytics &amp; Reports
          </h2>
          <p className="text-sm text-slate-500">
            Institutional attendance telemetry across all UCC courses, departments, and programmes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleExport('pdf')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#061430] hover:bg-slate-800 text-white text-xs sm:text-sm font-bold cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* University Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <select
          value={yearId}
          onChange={(e) => setYearId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
        >
          <option value="">All Academic Years</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </select>

        <select
          value={semesterId}
          onChange={(e) => setSemesterId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
        >
          <option value="">All Semesters</option>
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.academic_year_name} — {s.name}
            </option>
          ))}
        </select>

        <select
          value={deptId}
          onChange={(e) => setDeptId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={progId}
          onChange={(e) => setProgId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
        >
          <option value="">All Programmes</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
        >
          <option value="">All Courses</option>
          {coursesList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.title}
            </option>
          ))}
        </select>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <p className="text-xs font-bold uppercase text-slate-400">Overall Attendance</p>
          <p className="text-3xl font-extrabold text-blue-700 mt-1">
            {counts.overall_attendance_rate ?? 0}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {counts.total_sessions ?? 0} sessions • {counts.total_records ?? 0} check-ins
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <p className="text-xs font-bold uppercase text-slate-400">Critical Attendance</p>
          <p className="text-3xl font-extrabold text-red-600 mt-1">
            {counts.critical_students_count ?? 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Students below warning threshold</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <p className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-blue-700" /> Highest Dept
          </p>
          <p className="text-lg font-extrabold text-[#061430] mt-1 truncate">
            {overview?.highest_department?.name || '—'}
          </p>
          <p className="text-xs font-bold text-blue-700 mt-0.5">
            {overview?.highest_department ? `${overview.highest_department.attendance_rate}%` : 'No sessions yet'}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <p className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Lowest Dept
          </p>
          <p className="text-lg font-extrabold text-[#061430] mt-1 truncate">
            {overview?.lowest_department?.name || '—'}
          </p>
          <p className="text-xs font-bold text-red-600 mt-0.5">
            {overview?.lowest_department ? `${overview.lowest_department.attendance_rate}%` : 'No sessions yet'}
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 p-6 space-y-4">
          <h3 className="text-base font-extrabold text-[#061430]">Attendance by Department (%)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={depts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="code" tick={{ fontSize: 11, fontWeight: 700 }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, 'Rate']} />
                <Bar dataKey="attendance_rate" fill="#1d4ed8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 p-6 space-y-4">
          <h3 className="text-base font-extrabold text-[#061430]">Attendance by Programme (%)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="code" tick={{ fontSize: 11, fontWeight: 700 }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, 'Rate']} />
                <Bar dataKey="attendance_rate" fill="#dc2626" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 p-6 space-y-4">
          <h3 className="text-base font-extrabold text-[#061430]">
            University Attendance Trends Over Time (%)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, 'Rate']} />
                <Area type="monotone" dataKey="rate" stroke="#1d4ed8" fill="#bfdbfe" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 p-6 space-y-4">
          <h3 className="text-base font-extrabold text-[#061430]">Present vs Absent</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={overview?.present_vs_absent || []}
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
        </div>
      </div>

      {/* Course Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Course Code</th>
                <th className="py-3.5 px-5">Title</th>
                <th className="py-3.5 px-5">Lecturer</th>
                <th className="py-3.5 px-5">Enrolled</th>
                <th className="py-3.5 px-5">Sessions</th>
                <th className="py-3.5 px-5">Attendance Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
              {courses.map((c) => (
                <tr key={c.course_id} className="hover:bg-blue-50/40">
                  <td className="py-3.5 px-5 font-mono font-bold text-blue-700">{c.code}</td>
                  <td className="py-3.5 px-5 font-bold text-[#061430]">{c.title}</td>
                  <td className="py-3.5 px-5 text-slate-600">{c.lecturer}</td>
                  <td className="py-3.5 px-5 font-semibold">{c.enrolled_students}</td>
                  <td className="py-3.5 px-5">{c.sessions_held}</td>
                  <td className="py-3.5 px-5">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800">
                      {c.attendance_rate}%
                    </span>
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

export default AdminAnalytics;
