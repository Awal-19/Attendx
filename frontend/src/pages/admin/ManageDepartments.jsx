import React, { useState, useEffect } from 'react';
import { Building2, Plus, Trash2, X } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const ManageDepartments = () => {
  const [departments, setDepartments] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const { addToast } = useToast();

  const [form, setForm] = useState({
    name: '',
    code: '',
    faculty: 'School of Physical Sciences',
    head_of_department: '',
    description: '',
  });

  const loadDepartments = async () => {
    try {
      const res = await api.get('/academics/departments/');
      setDepartments(res.data);
    } catch {
      addToast('Failed to load departments.', 'error');
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/academics/departments/', form);
      addToast(`Department ${form.code} created!`, 'success');
      setModalOpen(false);
      setForm({
        name: '',
        code: '',
        faculty: 'School of Physical Sciences',
        head_of_department: '',
        description: '',
      });
      loadDepartments();
    } catch {
      addToast('Failed to create department.', 'error');
    }
  };

  const handleDelete = async (id, name) => {
    try {
      await api.delete(`/academics/departments/${id}/`);
      addToast(`Deleted ${name}.`, 'info');
      loadDepartments();
    } catch {
      addToast('Could not delete department.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Academic Departments</h2>
          <p className="text-sm text-slate-500">
            Manage University of Cape Coast faculties and departments
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Department</span>
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {departments.map((d) => (
          <div
            key={d.id}
            className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-mono text-xs font-bold">
                  {d.code}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-2">{d.name}</h3>
                <p className="text-xs text-slate-500">{d.faculty}</p>
              </div>
              <button
                onClick={() => handleDelete(d.id, d.name)}
                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">{d.description}</p>
            <div className="pt-3 border-t border-slate-100 grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <p className="text-slate-400">Programmes</p>
                <p className="font-bold text-slate-800">{d.programme_count}</p>
              </div>
              <div>
                <p className="text-slate-400">Courses</p>
                <p className="font-bold text-slate-800">{d.course_count}</p>
              </div>
              <div>
                <p className="text-slate-400">Lecturers</p>
                <p className="font-bold text-slate-800">{d.lecturer_count}</p>
              </div>
              <div>
                <p className="text-slate-400">Students</p>
                <p className="font-bold text-slate-800">{d.student_count}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create Academic Department</h3>
              <button onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Department of Economics"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="ECON"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Faculty / School
                  </label>
                  <input
                    type="text"
                    value={form.faculty}
                    onChange={(e) => setForm({ ...form, faculty: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Head of Department
                </label>
                <input
                  type="text"
                  value={form.head_of_department}
                  onChange={(e) => setForm({ ...form, head_of_department: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
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
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageDepartments;

