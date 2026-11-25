import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const ManageCourses = () => {
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const { addToast } = useToast();

  const [form, setForm] = useState({
    code: '',
    title: '',
    credit_hours: 3,
    level: '300',
    department: '',
    lecturer: '',
    venue: 'LT 12 - Science Complex',
    schedule_day: 'Monday',
    schedule_time: '08:30 AM - 10:30 AM',
  });

  const loadData = async () => {
    try {
      const [cRes, dRes, lRes] = await Promise.all([
        api.get('/courses/'),
        api.get('/academics/departments/'),
        api.get('/lecturers/'),
      ]);
      setCourses(cRes.data);
      setDepartments(dRes.data);
      setLecturers(lRes.data);
      if (dRes.data.length > 0 && !form.department) {
        setForm((prev) => ({
          ...prev,
          department: dRes.data[0].id,
          lecturer: lRes.data[0]?.id || '',
        }));
      }
    } catch {
      addToast('Failed to load courses.', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssignLecturer = async (courseId, lecturerId) => {
    try {
      await api.patch(`/courses/${courseId}/`, { lecturer: lecturerId || null });
      addToast('Course lecturer assignment updated!', 'success');
      loadData();
    } catch {
      addToast('Could not assign lecturer.', 'error');
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await api.post('/courses/', form);
      addToast(`Course ${form.code} created!`, 'success');
      setModalOpen(false);
      setForm((prev) => ({ ...prev, code: '', title: '' }));
      loadData();
    } catch {
      addToast('Could not create course.', 'error');
    }
  };

  const handleDeleteCourse = async (id, code) => {
    try {
      await api.delete(`/courses/${id}/`);
      addToast(`Deleted course ${code}.`, 'info');
      loadData();
    } catch {
      addToast('Failed to delete course.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            University Course Catalog & Lecturer Assignments
          </h2>
          <p className="text-sm text-slate-500">
            Manage courses across departments and assign or reassign faculty lecturers
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add University Course</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Code</th>
                <th className="py-3.5 px-5">Course Title & Venue</th>
                <th className="py-3.5 px-5">Department</th>
                <th className="py-3.5 px-5">Assigned Lecturer</th>
                <th className="py-3.5 px-5">Enrolled</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="py-3.5 px-5 font-mono font-bold text-indigo-600">{c.code}</td>
                  <td className="py-3.5 px-5">
                    <p className="font-bold text-slate-900">{c.title}</p>
                    <p className="text-xs text-slate-500">
                      Level {c.level} • {c.venue}
                    </p>
                  </td>
                  <td className="py-3.5 px-5 text-xs font-semibold text-slate-700">
                    {c.department_code}
                  </td>
                  <td className="py-3.5 px-5">
                    <select
                      value={c.lecturer || ''}
                      onChange={(e) => handleAssignLecturer(c.id, e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                    >
                      <option value="">Unassigned</option>
                      {lecturers.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.lecturer_profile?.title} {l.full_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 px-5 font-bold">{c.enrolled_count} students</td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      onClick={() => handleDeleteCourse(c.id, c.code)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create University Course</h3>
              <button onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateCourse} className="space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Course Code</label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="CSC 412"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Level</label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  >
                    {['100', '200', '300', '400'].map((l) => (
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
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
                  Assign Lecturer
                </label>
                <select
                  value={form.lecturer}
                  onChange={(e) => setForm({ ...form, lecturer: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lecturer_profile?.title} {l.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs cursor-pointer"
                >
                  Create Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageCourses;

