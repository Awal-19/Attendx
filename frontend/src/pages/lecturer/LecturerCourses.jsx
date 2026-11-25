import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Plus, Users, QrCode, MapPin, Clock, X } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const LecturerCourses = () => {
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const { addToast } = useToast();

  const [form, setForm] = useState({
    code: '',
    title: '',
    description: '',
    credit_hours: 3,
    level: '300',
    department: '',
    programme: '',
    venue: 'LT 12 - Science Complex',
    schedule_day: 'Monday',
    schedule_time: '08:30 AM - 10:30 AM',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, dRes, pRes] = await Promise.all([
        api.get('/courses/?mine=true'),
        api.get('/academics/departments/'),
        api.get('/academics/programmes/'),
      ]);
      setCourses(cRes.data);
      setDepartments(dRes.data);
      setProgrammes(pRes.data);
      if (dRes.data.length > 0 && !form.department) {
        setForm((prev) => ({
          ...prev,
          department: dRes.data[0].id,
          programme: pRes.data[0]?.id || '',
        }));
      }
    } catch {
      addToast('Failed to load courses.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await api.post('/courses/', form);
      addToast(`Course ${form.code} created successfully!`, 'success');
      setModalOpen(false);
      setForm((prev) => ({ ...prev, code: '', title: '', description: '' }));
      loadData();
    } catch (err) {
      addToast(
        err.response?.data?.code?.[0] || 'Could not create course. Verify course code is unique.',
        'error'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#061430]">My Courses &amp; Rosters</h2>
          <p className="text-sm text-slate-500">
            Create and manage your assigned UCC courses, view enrolled students, and start QR
            attendance
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-md transition hover:-translate-y-0.5 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
          }}
        >
          <Plus className="w-4 h-4" />
          <span>Create New Course</span>
        </button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6 text-blue-700" />
          </div>
          <h3 className="text-base font-bold text-[#061430]">No courses assigned yet</h3>
          <p className="text-xs text-slate-500">
            Click &ldquo;Create New Course&rdquo; above to add your first course.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((c) => (
            <div
              key={c.id}
              className="relative bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between space-y-5 hover:border-blue-400 transition overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-700 via-blue-600 to-red-600" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200/70 font-mono text-xs font-bold">
                    {c.code}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    Level {c.level} • {c.credit_hours} Credits
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#061430]">{c.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2">{c.description}</p>

                <div className="pt-2 space-y-1.5 text-xs text-slate-600 border-t border-slate-100">
                  <p className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-700" />
                    <span className="font-semibold">{c.enrolled_count} Enrolled Students</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-red-500" />
                    <span>{c.venue}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      {c.schedule_day} • {c.schedule_time}
                    </span>
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2.5">
                <Link
                  to={`/lecturer/courses/${c.id}`}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#061430] text-xs font-bold text-center transition"
                >
                  Student Roster ({c.enrolled_count})
                </Link>
                <Link
                  to={`/lecturer/live-session?course=${c.id}`}
                  className="py-2.5 px-3 rounded-xl text-white text-xs font-bold text-center flex items-center justify-center gap-1.5 transition hover:opacity-95"
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
      )}

      {/* Create Course Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-[#040d21]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-[#061430]">
                Create New University Course
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-red-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-3.5 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Course Code</label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. CSC 401"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Academic Level
                  </label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                  >
                    {['100', '200', '300', '400', '500', '600'].map((l) => (
                      <option key={l} value={l}>
                        Level {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Course Title</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Artificial Intelligence & Machine Learning"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lecture Venue
                  </label>
                  <input
                    type="text"
                    value={form.venue}
                    onChange={(e) => setForm({ ...form, venue: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Schedule Day
                  </label>
                  <input
                    type="text"
                    value={form.schedule_day}
                    onChange={(e) => setForm({ ...form, schedule_day: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Schedule Time
                  </label>
                  <input
                    type="text"
                    value={form.schedule_time}
                    onChange={(e) => setForm({ ...form, schedule_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-white font-bold text-xs cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 65%, #dc2626 100%)',
                  }}
                >
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerCourses;
