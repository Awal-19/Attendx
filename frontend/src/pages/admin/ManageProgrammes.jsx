import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const ManageProgrammes = () => {
  const [programmes, setProgrammes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const { addToast } = useToast();

  const [form, setForm] = useState({
    name: '',
    code: '',
    department: '',
    degree_type: 'B.Sc.',
    duration_years: 4,
  });

  const loadData = async () => {
    try {
      const [pRes, dRes] = await Promise.all([
        api.get('/academics/programmes/'),
        api.get('/academics/departments/'),
      ]);
      setProgrammes(pRes.data);
      setDepartments(dRes.data);
      if (dRes.data.length > 0 && !form.department) {
        setForm((prev) => ({ ...prev, department: dRes.data[0].id }));
      }
    } catch {
      addToast('Failed to load programmes.', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/academics/programmes/', form);
      addToast(`Programme ${form.name} created!`, 'success');
      setModalOpen(false);
      setForm((prev) => ({ ...prev, name: '', code: '' }));
      loadData();
    } catch {
      addToast('Could not create programme.', 'error');
    }
  };

  const handleDelete = async (id, name) => {
    try {
      await api.delete(`/academics/programmes/${id}/`);
      addToast(`Removed ${name}.`, 'info');
      loadData();
    } catch {
      addToast('Failed to remove programme.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Degree Programmes</h2>
          <p className="text-sm text-slate-500">
            Manage undergraduate and postgraduate degree programmes at UCC
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Programme</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-3.5 px-5">Code</th>
              <th className="py-3.5 px-5">Programme Name</th>
              <th className="py-3.5 px-5">Department</th>
              <th className="py-3.5 px-5">Duration</th>
              <th className="py-3.5 px-5">Students</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
            {programmes.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="py-3.5 px-5 font-mono font-bold text-indigo-600">{p.code}</td>
                <td className="py-3.5 px-5 font-bold text-slate-900">{p.name}</td>
                <td className="py-3.5 px-5 text-slate-600">{p.department_name}</td>
                <td className="py-3.5 px-5">{p.duration_years} Years</td>
                <td className="py-3.5 px-5 font-bold">{p.student_count}</td>
                <td className="py-3.5 px-5 text-right">
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create Degree Programme</h3>
              <button onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Programme Name
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="B.Sc. Cybersecurity"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Programme Code
                </label>
                <input
                  type="text"
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="BSC-CYB"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
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
                  Save Programme
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageProgrammes;

