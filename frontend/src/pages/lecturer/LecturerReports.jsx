import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Filter,
  Search,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const LecturerReports = () => {
  const [reportData, setReportData] = useState(null);
  const [defaulters, setDefaulters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [activeTab, setActiveTab] = useState('reports');

  // Filters
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedProgramme, setSelectedProgramme] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [period, setPeriod] = useState('semester');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [defaulterSearch, setDefaulterSearch] = useState('');
  const [maxPct, setMaxPct] = useState('75');

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    Promise.all([
      api.get('/courses/?mine=true'),
      api.get('/academics/programmes/'),
      api.get('/academics/semesters/'),
    ])
      .then(([cRes, pRes, sRes]) => {
        setCourses(cRes.data);
        setProgrammes(pRes.data);
        setSemesters(sRes.data);
      })
      .catch(() => {});
  }, []);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedCourse) params.append('course', selectedCourse);
    if (selectedProgramme) params.append('programme', selectedProgramme);
    if (selectedSemester) params.append('semester', selectedSemester);
    if (period) params.append('period', period);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return params.toString() ? `?${params.toString()}` : '';
  }, [selectedCourse, selectedProgramme, selectedSemester, period, startDate, endDate]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQueryString();
      const dParams = new URLSearchParams();
      if (selectedCourse) dParams.append('course', selectedCourse);
      if (selectedProgramme) dParams.append('programme', selectedProgramme);
      if (selectedSemester) dParams.append('semester', selectedSemester);
      if (maxPct) dParams.append('max_percentage', maxPct);
      if (defaulterSearch.trim()) dParams.append('search', defaulterSearch.trim());

      const [repRes, defRes] = await Promise.all([
        api.get(`/reports/attendance/${qs}`),
        api.get(`/reports/defaulters/?${dParams.toString()}`),
      ]);
      setReportData(repRes.data);
      setDefaulters(defRes.data);
    } catch {
      addToast('Failed to load attendance reports.', 'error');
    } finally {
      setLoading(false);
    }
  }, [
    buildQueryString,
    selectedCourse,
    selectedProgramme,
    selectedSemester,
    maxPct,
    defaulterSearch,
    addToast,
  ]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleDownloadFile = async (format) => {
    setExporting(format);
    try {
      const query = buildQueryString();
      const endpoint =
        format === 'pdf'
          ? `/reports/attendance/pdf/${query}`
          : format === 'csv'
          ? `/reports/attendance/csv/${query}`
          : `/reports/attendance/excel/${query}`;
      const res = await api.get(endpoint, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      const ext = format === 'pdf' ? 'pdf' : format === 'csv' ? 'csv' : 'xlsx';
      link.setAttribute('download', `AttendX_UCC_Attendance_Report.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      addToast(
        `Official UCC ${format.toUpperCase()} Attendance Report downloaded!`,
        'success'
      );
    } catch {
      addToast(`Failed to export ${format.toUpperCase()} report.`, 'error');
    } finally {
      setExporting('');
    }
  };

  const summary = reportData?.summary || {};
  const trends = reportData?.session_trends || [];
  const records = reportData?.records || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#061430]">
            Attendance Reports, Defaulters &amp; Exports
          </h2>
          <p className="text-sm text-slate-500">
            Generate Daily, Weekly, Monthly &amp; Semester UCC reports, identify attendance
            defaulters, and export PDF / Excel / CSV
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleDownloadFile('pdf')}
            disabled={exporting === 'pdf'}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>{exporting === 'pdf' ? 'Generating...' : 'Export PDF'}</span>
          </button>

          <button
            onClick={() => handleDownloadFile('excel')}
            disabled={exporting === 'excel'}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{exporting === 'excel' ? 'Generating...' : 'Export Excel'}</span>
          </button>

          <button
            onClick={() => handleDownloadFile('csv')}
            disabled={exporting === 'csv'}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#061430] hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{exporting === 'csv' ? 'Generating...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Filters & Period Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-[#061430]"
        >
          <option value="daily">Daily Report</option>
          <option value="weekly">Weekly Report</option>
          <option value="monthly">Monthly Report</option>
          <option value="semester">Semester Report</option>
        </select>

        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
        >
          <option value="">All My Courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.title}
            </option>
          ))}
        </select>

        <select
          value={selectedProgramme}
          onChange={(e) => setSelectedProgramme(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
        >
          <option value="">All Programmes</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={selectedSemester}
          onChange={(e) => setSelectedSemester(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
        >
          <option value="">All Semesters</option>
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.academic_year_name} — {s.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700"
          title="Start Date"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700"
          title="End Date"
        />
      </div>

      {/* Tabs: Reports vs Attendance Defaulters */}
      <div className="inline-flex rounded-xl bg-slate-200/80 p-1">
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'reports' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-700'
          }`}
        >
          Attendance Reports ({records.length})
        </button>
        <button
          onClick={() => setActiveTab('defaulters')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'defaulters' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-700'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Attendance Defaulters ({defaulters.length})</span>
        </button>
      </div>

      {activeTab === 'reports' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative bg-white p-5 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-blue-800" />
              <p className="text-xs font-bold uppercase text-slate-400">Total Verified Records</p>
              <p className="text-3xl font-extrabold text-[#061430] mt-1">
                {summary.total_records ?? 0}
              </p>
            </div>
            <div className="relative bg-white p-5 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-blue-600" />
              <p className="text-xs font-bold uppercase text-slate-400">QR &amp; Face Scans</p>
              <p className="text-3xl font-extrabold text-blue-700 mt-1">
                {summary.qr_scan_count ?? 0}
              </p>
            </div>
            <div className="relative bg-white p-5 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-red-600" />
              <p className="text-xs font-bold uppercase text-slate-400">Manual Overrides</p>
              <p className="text-3xl font-extrabold text-red-600 mt-1">
                {summary.manual_count ?? 0}
              </p>
            </div>
            <div className="relative bg-white p-5 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-700 to-red-600" />
              <p className="text-xs font-bold uppercase text-slate-400">Present Count</p>
              <p className="text-3xl font-extrabold text-[#061430] mt-1">
                {summary.present_count ?? 0}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <h3 className="text-base font-extrabold text-[#061430]">
              Session Attendance Turnout Trend (%)
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="uccTurnoutArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Turnout Rate']} />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="#1d4ed8"
                    fill="url(#uccTurnoutArea)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-extrabold text-[#061430]">
                Exportable Attendance Log ({records.length} rows)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-5">Index Number</th>
                    <th className="py-3 px-5">Student Name</th>
                    <th className="py-3 px-5">Course</th>
                    <th className="py-3 px-5">Session</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Method</th>
                    <th className="py-3 px-5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Loading records...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No attendance records match your selected filters.
                      </td>
                    </tr>
                  ) : (
                    records.slice(0, 50).map((r) => (
                      <tr key={r.id} className="hover:bg-blue-50/40">
                        <td className="py-3 px-5 font-mono font-bold text-blue-700">
                          {r.student_index_number}
                        </td>
                        <td className="py-3 px-5 font-semibold text-[#061430]">
                          {r.student_name}
                        </td>
                        <td className="py-3 px-5 font-mono font-bold">{r.course_code}</td>
                        <td className="py-3 px-5 text-slate-600">{r.session_title}</td>
                        <td className="py-3 px-5">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200/70">
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-5 font-mono text-xs">{r.verification_method}</td>
                        <td className="py-3 px-5 font-mono text-xs text-slate-500">
                          {new Date(r.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Attendance Defaulters Management */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={defaulterSearch}
                onChange={(e) => setDefaulterSearch(e.target.value)}
                placeholder="Search student name or index..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm"
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <span>Threshold below (%):</span>
              <input
                type="number"
                min="10"
                max="100"
                value={maxPct}
                onChange={(e) => setMaxPct(e.target.value)}
                className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-5">Index Number</th>
                  <th className="py-3 px-5">Student &amp; Programme</th>
                  <th className="py-3 px-5">Course</th>
                  <th className="py-3 px-5">Attended / Total</th>
                  <th className="py-3 px-5">Missed</th>
                  <th className="py-3 px-5">Attendance %</th>
                  <th className="py-3 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
                {defaulters.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      No attendance defaulters found below {maxPct}%.
                    </td>
                  </tr>
                ) : (
                  defaulters.map((d, idx) => (
                    <tr key={`${d.student_id}-${d.course_id}-${idx}`} className="hover:bg-red-50/35">
                      <td className="py-3 px-5 font-mono font-bold text-blue-700">
                        {d.index_number}
                      </td>
                      <td className="py-3 px-5">
                        <p className="font-bold text-[#061430]">{d.student_name}</p>
                        <p className="text-xs text-slate-500">{d.programme_name}</p>
                      </td>
                      <td className="py-3 px-5 font-mono font-bold text-[#061430]">
                        {d.course_code}
                      </td>
                      <td className="py-3 px-5 font-mono">
                        {d.attended_sessions} / {d.total_sessions}
                      </td>
                      <td className="py-3 px-5 font-bold text-red-600">{d.missed_sessions}</td>
                      <td className="py-3 px-5 font-extrabold text-red-600">
                        {d.attendance_percentage}%
                      </td>
                      <td className="py-3 px-5">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                          {d.attendance_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerReports;
