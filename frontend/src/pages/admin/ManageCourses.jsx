import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, Upload, Edit3, Power } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const ManageCourses = () => {
  const [activeTab, setActiveTab] = useState('offerings');
  const [courses, setCourses] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null);
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

  const [catForm, setCatForm] = useState({
    course_code: '',
    course_title: '',
    credits: 3,
    level: '100',
    semester: 1,
    department: '',
    is_active: true,
  });

  const loadData = async () => {
    try {
      const [cRes, catRes, dRes, lRes] = await Promise.all([
        api.get('/courses/'),
        api.get('/academics/catalog/?include_inactive=true'),
        api.get('/academics/departments/'),
        api.get('/lecturers/'),
      ]);
      setCourses(cRes.data);
      setCatalog(catRes.data);
      setDepartments(dRes.data);
      setLecturers(lRes.data);
      if (dRes.data.length > 0 && !form.department) {
        setForm((prev) => ({
          ...prev,
          department: dRes.data[0].id,
          lecturer: lRes.data[0]?.id || '',
        }));
      }
      if (dRes.data.length > 0 && !catForm.department) {
        setCatForm((prev) => ({
          ...prev,
          department: dRes.data[0].id,
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

  const openAddCatalog = () => {
    setEditingCatalog(null);
    setCatForm({
      course_code: '',
      course_title: '',
      credits: 3,
      level: '100',
      semester: 1,
      department: departments[0]?.id || '',
      is_active: true,
    });
    setCatalogModalOpen(true);
  };

  const openEditCatalog = (entry) => {
    setEditingCatalog(entry);
    setCatForm({
      course_code: entry.course_code,
      course_title: entry.course_title,
      credits: entry.credits,
      level: entry.level,
      semester: entry.semester,
      department: entry.department,
      is_active: entry.is_active,
    });
    setCatalogModalOpen(true);
  };

  const handleSaveCatalog = async (e) => {
    e.preventDefault();
    try {
      if (editingCatalog) {
        await api.patch(`/academics/catalog/${editingCatalog.id}/`, catForm);
        addToast(`Updated catalog course ${catForm.course_code}.`, 'success');
      } else {
        await api.post('/academics/catalog/', catForm);
        addToast(`Added catalog course ${catForm.course_code}.`, 'success');
      }
      setCatalogModalOpen(false);
      loadData();
    } catch (err) {
      addToast(
        err.response?.data?.course_code?.[0] ||
        err.response?.data?.detail ||
        'Could not save catalog course.',
        'error'
      );
    }
  };

  const handleToggleCatalogActive = async (entry) => {
    try {
      await api.patch(`/academics/catalog/${entry.id}/`, { is_active: !entry.is_active });
      addToast(
        `${entry.course_code} ${entry.is_active ? 'deactivated' : 'activated'}.`,
        'info'
      );
      loadData();
    } catch {
      addToast('Could not update catalog status.', 'error');
    }
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCsv(true);
    setUploadSummary(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post('/academics/catalog/upload/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadSummary(res.data);
      addToast(
        `CSV imported: ${res.data.created} created, ${res.data.updated} updated.`,
        'success'
      );
      loadData();
    } catch (err) {
      addToast(err.response?.data?.error || 'CSV upload failed.', 'error');
    } finally {
      setUploadingCsv(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            University Course Catalog &amp; Lecturer Assignments
          </h2>
          <p className="text-sm text-slate-500">
            Manage official UCC catalog courses, upload course_catalog.csv, and assign lecturers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('offerings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${activeTab === 'offerings'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-700'
              }`}
          >
            Course Offerings ({courses.length})
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${activeTab === 'catalog'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-700'
              }`}
          >
            Official Catalog ({catalog.length})
          </button>
          {activeTab === 'offerings' ? (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add University Course</span>
            </button>
          ) : (
            <>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>{uploadingCsv ? 'Uploading...' : 'Upload CSV'}</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  className="hidden"
                  disabled={uploadingCsv}
                />
              </label>
              <button
                onClick={openAddCatalog}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Catalog Course</span>
              </button>
            </>
          )}
        </div>
      </div>

      {uploadSummary && activeTab === 'catalog' && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
          <p className="font-bold">
            Import Complete: {uploadSummary.created} created, {uploadSummary.updated} updated,{' '}
            {uploadSummary.duplicates?.length || 0} duplicates,{' '}
            {uploadSummary.malformed?.length || 0} malformed rows.
          </p>
        </div>
      )}

      {activeTab === 'catalog' ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Code</th>
                  <th className="py-3.5 px-5">Official Title</th>
                  <th className="py-3.5 px-5">Level / Sem</th>
                  <th className="py-3.5 px-5">Credits</th>
                  <th className="py-3.5 px-5">Department</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
                {catalog.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-5 font-mono font-bold text-indigo-600">
                      {entry.course_code}
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-slate-900">
                      {entry.course_title}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-600">
                      Level {entry.level} • Sem {entry.semester}
                    </td>
                    <td className="py-3.5 px-5 text-xs font-semibold text-slate-700">
                      {entry.credits}
                    </td>
                    <td className="py-3.5 px-5 text-xs font-semibold text-slate-700">
                      {entry.department_code}
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${entry.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                          }`}
                      >
                        {entry.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right space-x-1">
                      <button
                        onClick={() => openEditCatalog(entry)}
                        className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                        title="Edit catalog course"
                      >
                        <Edit3 className="w-4 h-4 inline" />
                      </button>
                      <button
                        onClick={() => handleToggleCatalogActive(entry)}
                        className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 cursor-pointer"
                        title={entry.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <Power className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (

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
      )}

      {catalogModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingCatalog ? 'Edit Catalog Course' : 'Add Catalog Course'}
              </h3>
              <button onClick={() => setCatalogModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSaveCatalog} className="space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Course Code</label>
                  <input
                    type="text"
                    required
                    value={catForm.course_code}
                    onChange={(e) =>
                      setCatForm({ ...catForm, course_code: e.target.value.toUpperCase() })
                    }
                    placeholder="CSC 101"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Credits</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    required
                    value={catForm.credits}
                    onChange={(e) =>
                      setCatForm({ ...catForm, credits: parseInt(e.target.value, 10) || 3 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Course Title</label>
                <input
                  type="text"
                  required
                  value={catForm.course_title}
                  onChange={(e) => setCatForm({ ...catForm, course_title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Level</label>
                  <select
                    value={catForm.level}
                    onChange={(e) => setCatForm({ ...catForm, level: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  >
                    {['100', '200', '300', '400', '500', '600'].map((l) => (
                      <option key={l} value={l}>
                        Level {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Semester</label>
                  <select
                    value={catForm.semester}
                    onChange={(e) =>
                      setCatForm({ ...catForm, semester: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={catForm.department}
                  onChange={(e) => setCatForm({ ...catForm, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCatalogModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs cursor-pointer"
                >
                  {editingCatalog ? 'Save Changes' : 'Add to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

