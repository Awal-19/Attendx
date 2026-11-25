import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, Plus, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const SystemSettings = () => {
  const [years, setYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [newYearName, setNewYearName] = useState('');
  const [thresholds, setThresholds] = useState({ excellent: 90, good: 75, warning: 60 });
  const { addToast } = useToast();

  const loadCalendar = async () => {
    try {
      const [yRes, sRes, pRes] = await Promise.all([
        api.get('/academics/academic-years/'),
        api.get('/academics/semesters/'),
        api.get('/reports/policy/'),
      ]);
      setYears(yRes.data);
      setSemesters(sRes.data);
      if (pRes.data) setThresholds(pRes.data);
    } catch {
      // ignore
    }
  };

  const handleSaveThresholds = async (e) => {
    e.preventDefault();
    try {
      await api.patch('/reports/policy/', thresholds);
      addToast('University attendance thresholds updated!', 'success');
    } catch {
      addToast('Could not update attendance thresholds.', 'error');
    }
  };

  useEffect(() => {
    loadCalendar();
  }, []);

  const handleSetActiveYear = async (yearId) => {
    try {
      await api.patch(`/academics/academic-years/${yearId}/`, { is_current: true });
      addToast('Active academic year updated!', 'success');
      loadCalendar();
    } catch {
      addToast('Failed to update academic year.', 'error');
    }
  };

  const handleSetActiveSemester = async (semId) => {
    try {
      await api.patch(`/academics/semesters/${semId}/`, { is_current: true });
      addToast('Current semester updated!', 'success');
      loadCalendar();
    } catch {
      addToast('Failed to update semester.', 'error');
    }
  };

  const handleCreateYear = async (e) => {
    e.preventDefault();
    if (!newYearName.trim()) return;
    try {
      await api.post('/academics/academic-years/', {
        name: newYearName.trim(),
        start_date: '2027-09-01',
        end_date: '2028-07-30',
        is_current: false,
      });
      addToast(`Academic Year ${newYearName} added!`, 'success');
      setNewYearName('');
      loadCalendar();
    } catch {
      addToast('Could not create academic year.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">
          Academic Calendar & University System Settings
        </h2>
        <p className="text-sm text-slate-500">
          Configure academic years, active semesters, and cryptographic QR security policies
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Academic Years */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Academic Years</span>
            </h3>
          </div>

          <form onSubmit={handleCreateYear} className="flex gap-2">
            <input
              type="text"
              value={newYearName}
              onChange={(e) => setNewYearName(e.target.value)}
              placeholder="e.g. 2027/2028"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </form>

          <div className="space-y-2.5">
            {years.map((y) => (
              <div
                key={y.id}
                className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">{y.name}</p>
                  <p className="text-xs text-slate-500">
                    {y.start_date} to {y.end_date}
                  </p>
                </div>
                {y.is_current ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Current Year
                  </span>
                ) : (
                  <button
                    onClick={() => handleSetActiveYear(y.id)}
                    className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-indigo-700 text-xs font-bold cursor-pointer"
                  >
                    Set Current
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Semesters */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>University Semesters</span>
          </h3>

          <div className="space-y-2.5">
            {semesters.map((s) => (
              <div
                key={s.id}
                className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {s.academic_year_name} — {s.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.start_date} to {s.end_date}
                  </p>
                </div>
                {s.is_current ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active Semester
                  </span>
                ) : (
                  <button
                    onClick={() => handleSetActiveSemester(s.id)}
                    className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-indigo-700 text-xs font-bold cursor-pointer"
                  >
                    Activate
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Attendance Status Thresholds Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-4">
        <h3 className="text-base font-extrabold text-[#061430]">
          Configurable Student Attendance Status Thresholds (%)
        </h3>
        <form onSubmit={handleSaveThresholds} className="grid sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Excellent Attendance (&ge; %)
            </label>
            <input
              type="number"
              min="50"
              max="100"
              value={thresholds.excellent}
              onChange={(e) => setThresholds({ ...thresholds, excellent: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Good Attendance (&ge; %)
            </label>
            <input
              type="number"
              min="30"
              max="95"
              value={thresholds.good}
              onChange={(e) => setThresholds({ ...thresholds, good: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Warning Threshold (&ge; %)
            </label>
            <input
              type="number"
              min="10"
              max="90"
              value={thresholds.warning}
              onChange={(e) => setThresholds({ ...thresholds, warning: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
            />
          </div>
          <button
            type="submit"
            className="py-2.5 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold cursor-pointer"
          >
            Save Thresholds
          </button>
        </form>
      </div>

      {/* Security Policy Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2.5 text-emerald-400">
          <ShieldCheck className="w-5 h-5" />
          <h3 className="text-base font-bold">
            Active AttendX Cryptographic & Database Security Policies
          </h3>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 text-xs text-slate-300 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <p className="font-bold text-white">HMAC-SHA256 QR Signatures</p>
            <p className="text-slate-400 mt-1">
              Every projected QR token is signed with server secret and bound to a strict expiration
              window.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <p className="font-bold text-white">PostgreSQL Unique Constraints</p>
            <p className="text-slate-400 mt-1">
              Database constraint unique_student_attendance_per_session prevents duplicate scans at
              the storage layer.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <p className="font-bold text-white">Anti-Spoofing Identity Lock</p>
            <p className="text-slate-400 mt-1">
              Student identity is extracted exclusively from the verified SimpleJWT access token.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;

