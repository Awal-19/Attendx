import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const ManageLecturers = () => {
  const [lecturers, setLecturers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { addToast } = useToast();

  const [form, setForm] = useState({
    title: 'Dr.',
    full_name: '',
    staff_id: '',
    email: '',
    password: 'Lecturer@12345',
    department_id: '',
    specialization: 'Computer Systems',
  });

  const loadData = async () => {
    try {
      const [lRes, dRes] = await Promise.all([
        api.get('/auth/users/?role=LECTURER'),
        api.get('/academics/departments/'),
      ]);
      setLecturers(lRes.data);
      setDepartments(dRes.data);
      if (dRes.data.length > 0 && !form.department_id) {
        setForm((prev) => ({ ...prev, department_id: dRes.data[0].id }));
      }
    } catch {
      addToast('Failed to load lecturers.', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateLecturer = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register/', { ...form, role: 'LECTURER' });
      addToast(`Lecturer ${form.full_name} added!`, 'success');
      setModalOpen(false);
      setForm((prev) => ({ ...prev, full_name: '', staff_id: '', email: '' }));
      loadData();
    } catch (err) {
      addToast(
        err.response?.data?.email?.[0] ||
          err.response?.data?.staff_id?.[0] ||
          'Could not create lecturer.',
        'error'
      );
    }
  };

  const toggleActive = async (lec) => {
    try {
      await api.patch(`/auth/users/${lec.id}/`, { is_active: !lec.is_active });
      addToast(`Updated status for ${lec.full_name}.`, 'info');
      loadData();
    } catch {
      addToast('Failed to update status.', 'error');
    }
  };

  const deleteLecturer = async (lec) => {
    try {
      await api.delete(`/auth/users/${lec.id}/`);
      addToast(`Removed lecturer ${lec.full_name}.`, 'info');
      loadData();
    } catch {
      addToast('Failed to delete lecturer.', 'error');
    }
  };

  const filtered = lecturers.filter(
    (l) =>
      l.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.email?.toLowerCase().includes(search.toLowerCase()) ||
      l.lecturer_profile?.staff_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Faculty Lecturer Management</h2>
          <p className="text-sm text-slate-500">
            Onboard university lecturers, verify Staff IDs, and manage departmental assignments
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search faculty..."
              className="pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm"
            />
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Lecturer</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Staff ID</th>
                <th className="py-3.5 px-5">Lecturer Name & Email</th>
                <th className="py-3.5 px-5">Department</th>
                <th className="py-3.5 px-5">Specialization</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
              {filtered.map((lec) => {
                const lp = lec.lecturer_profile || {};
                return (
                  <tr key={lec.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-5 font-mono font-bold text-emerald-700">
                      {lp.staff_id || 'N/A'}
                    </td>
                    <td className="py-3.5 px-5">
                      <p className="font-bold text-slate-900">
                        {lp.title} {lec.full_name}
                      </p>
                      <p className="text-xs text-slate-500">{lec.email}</p>
                    </td>
                    <td className="py-3.5 px-5 text-xs font-semibold text-slate-700">
                      {lp.department_name || 'Physical Sciences'}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-500">
                      {lp.specialization || 'General'}
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          lec.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {lec.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right space-x-2">
                      <button
                        onClick={() => toggleActive(lec)}
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        {lec.is_active ? (
                          <ToggleRight className="w-5 h-5 text-emerald-600 inline" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-slate-400 inline" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteLecturer(lec)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Onboard Faculty Lecturer</h3>
              <button onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateLecturer} className="space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Title</label>
                  <select
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  >
                    {['Dr.', 'Prof.', 'Mr.', 'Mrs.', 'Ms.'].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Staff ID</label>
                <input
                  type="text"
                  required
                  value={form.staff_id}
                  onChange={(e) => setForm({ ...form, staff_id: e.target.value.toUpperCase() })}
                  placeholder="UCC/STAFF/1250"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Faculty Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}
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
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                >
                  Create Lecturer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageLecturers;

