import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Plus, Users, QrCode, MapPin, Clock, X, Search, Send } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const LecturerCourses = () => {
  const [courses, setCourses] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCatalog, setSelectedCatalog] = useState(null);
  const { addToast } = useToast();

  const [form, setForm] = useState({
    catalog_entry: '',
    semester: '',
    description: '',
    venue: 'LT 12 - Science Complex',
    schedule_day: 'Monday',
    schedule_time: '08:30 AM - 10:30 AM',
  });

  const [reqForm, setReqForm] = useState({
    course_code: '',
    course_title: '',
    level: '300',
    notes: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, catRes, semRes] = await Promise.all([
        api.get('/courses/?mine=true'),
        api.get('/academics/catalog/'),
        api.get('/academics/semesters/'),
      ]);
      setCourses(cRes.data);
      setCatalog(catRes.data);
      setSemesters(semRes.data);
      const currentSem = semRes.data.find((s) => s.is_current) || semRes.data[0];
      if (currentSem && !form.semester) {
        setForm((prev) => ({
          ...prev,
          semester: currentSem.id,
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

  const filteredCatalog = catalog.filter((entry) => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      entry.course_code.toLowerCase().includes(q) ||
      entry.course_title.toLowerCase().includes(q)
    );
  });

  const handleSelectCatalog = (entry) => {
    setSelectedCatalog(entry);
    setForm((prev) => ({ ...prev, catalog_entry: entry.id }));
    setCatalogSearch(`${entry.course_code} - ${entry.course_title}`);
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!form.catalog_entry) {
      addToast('Please select an official course from the Course Catalog.', 'error');
      return;
    }
    try {
      await api.post('/courses/', {
        catalog_entry: form.catalog_entry,
        semester: form.semester || undefined,
        description: form.description,
        venue: form.venue,
        schedule_day: form.schedule_day,
        schedule_time: form.schedule_time,
      });
      addToast(`Course ${selectedCatalog?.course_code || ''} created successfully!`, 'success');
      setModalOpen(false);
      setSelectedCatalog(null);
      setCatalogSearch('');
      setForm((prev) => ({ ...prev, catalog_entry: '', description: '' }));
      loadData();
    } catch (err) {
      addToast(
        err.response?.data?.catalog_entry?.[0] ||
          err.response?.data?.detail ||
          'Could not create course.',
        'error'
      );
    }
  };

  const handleRequestCourse = async (e) => {
    e.preventDefault();
    try {
      await api.post('/academics/catalog/request/', reqForm);
      addToast('Course request sent to administrators.', 'success');
      setRequestModalOpen(false);
      setReqForm({ course_code: '', course_title: '', level: '300', notes: '' });
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not submit course request.', 'error');
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
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Search Official Course Catalog
                  </label>
                  <button
                    type="button"
                    onClick={() => setRequestModalOpen(true)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 underline cursor-pointer"
                  >
                    Request a new course
                  </button>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => {
                      setCatalogSearch(e.target.value);
                      if (selectedCatalog) {
                        setSelectedCatalog(null);
                        setForm((prev) => ({ ...prev, catalog_entry: '' }));
                      }
                    }}
                    placeholder="Search by course code or title (e.g. CSC 101)..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                  />
                </div>
                {!selectedCatalog && (
                  <div className="mt-1.5 max-h-36 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50">
                    {filteredCatalog.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500 flex items-center justify-between">
                        <span>No matching course in catalog.</span>
                        <button
                          type="button"
                          onClick={() => setRequestModalOpen(true)}
                          className="text-blue-600 font-bold hover:underline cursor-pointer"
                        >
                          Request a new course
                        </button>
                      </div>
                    ) : (
                      filteredCatalog.slice(0, 20).map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => handleSelectCatalog(entry)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 transition flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div>
                            <span className="font-mono font-bold text-blue-700 mr-2">
                              {entry.course_code}
                            </span>
                            <span className="text-slate-800 font-medium">{entry.course_title}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 shrink-0">
                            L{entry.level} • {entry.credits}cr
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {selectedCatalog && (
                <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5">
                      Course Code
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={selectedCatalog.course_code}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-100 font-mono text-xs text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5">
                      Level
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={`Level ${selectedCatalog.level}`}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-xs text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5">
                      Credits
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={`${selectedCatalog.credits} Credits`}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-xs text-slate-700"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[11px] font-bold text-slate-500 mb-0.5">
                      Official Course Title
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={selectedCatalog.course_title}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-xs text-slate-700"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Academic Year &amp; Semester
                  </label>
                  <select
                    value={form.semester}
                    onChange={(e) => setForm({ ...form, semester: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                  >
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.academic_year_name} - {s.name}
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

      {requestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Request New Course in Catalog
              </h3>
              <button
                onClick={() => setRequestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRequestCourse} className="space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Course Code</label>
                  <input
                    type="text"
                    required
                    value={reqForm.course_code}
                    onChange={(e) =>
                      setReqForm({ ...reqForm, course_code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. CSC 415"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Level</label>
                  <select
                    value={reqForm.level}
                    onChange={(e) => setReqForm({ ...reqForm, level: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
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
                  value={reqForm.course_title}
                  onChange={(e) => setReqForm({ ...reqForm, course_title: e.target.value })}
                  placeholder="Official course title"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={reqForm.notes}
                  onChange={(e) => setReqForm({ ...reqForm, notes: e.target.value })}
                  placeholder="Optional justification or department details..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Request</span>
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
