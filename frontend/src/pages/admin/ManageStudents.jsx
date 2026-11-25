import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Upload,
  Download,
  Edit3,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const ManageStudents = () => {
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterProg, setFilterProg] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [createAccounts, setCreateAccounts] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const { addToast } = useToast();

  const [form, setForm] = useState({
    full_name: '',
    index_number: '',
    email: '',
    password: 'Student@12345',
    department_id: '',
    programme_id: '',
    academic_level: '300',
    phone_number: '',
  });

  const [editForm, setEditForm] = useState({
    full_name: '',
    index_number: '',
    department_id: '',
    programme_id: '',
    academic_level: '300',
    verification_status: 'VERIFIED',
    phone_number: '',
  });

  const loadAcademics = useCallback(async () => {
    try {
      const [dRes, pRes] = await Promise.all([
        api.get('/academics/departments/'),
        api.get('/academics/programmes/'),
      ]);
      setDepartments(dRes.data);
      setProgrammes(pRes.data);
      if (dRes.data.length > 0) {
        setForm((prev) => ({
          ...prev,
          department_id: prev.department_id || dRes.data[0].id,
          programme_id: prev.programme_id || pRes.data[0]?.id || '',
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (filterDept) params.append('department', filterDept);
      if (filterProg) params.append('programme', filterProg);
      if (filterLevel) params.append('level', filterLevel);
      if (filterStatus) params.append('verification_status', filterStatus);

      const res = await api.get(`/students/?${params.toString()}`);
      setStudents(res.data);
    } catch {
      addToast('Failed to load student records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, filterDept, filterProg, filterLevel, filterStatus, addToast]);

  useEffect(() => {
    loadAcademics();
  }, [loadAcademics]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStudents();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadStudents]);

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    try {
      await api.post('/students/', form);
      addToast(`Student ${form.full_name} added and verified!`, 'success');
      setAddModalOpen(false);
      setForm((prev) => ({
        ...prev,
        full_name: '',
        index_number: '',
        email: '',
        phone_number: '',
      }));
      loadStudents();
    } catch (err) {
      addToast(
        err.response?.data?.email?.[0] ||
          err.response?.data?.index_number?.[0] ||
          err.response?.data?.error ||
          'Could not create student.',
        'error'
      );
    }
  };

  const openEditModal = (st) => {
    const sp = st.student_profile || {};
    setEditStudent(st);
    setEditForm({
      full_name: st.full_name || '',
      index_number: sp.index_number || '',
      department_id: sp.department || departments[0]?.id || '',
      programme_id: sp.programme || programmes[0]?.id || '',
      academic_level: sp.academic_level || '300',
      verification_status: sp.verification_status || 'PENDING',
      phone_number: st.phone_number || '',
    });
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    if (!editStudent) return;
    try {
      await api.patch(`/students/${editStudent.id}/`, editForm);
      addToast(`Updated academic record for ${editForm.full_name}.`, 'success');
      setEditStudent(null);
      loadStudents();
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not update student record.', 'error');
    }
  };

  const toggleActive = async (st) => {
    try {
      await api.patch(`/students/${st.id}/`, { is_active: !st.is_active });
      addToast(
        `${st.full_name} is now ${!st.is_active ? 'Active' : 'Deactivated'}.`,
        'info'
      );
      loadStudents();
    } catch {
      addToast('Could not update student account status.', 'error');
    }
  };

  const deleteStudent = async (st) => {
    try {
      await api.delete(`/students/${st.id}/`);
      addToast(`Deleted student ${st.full_name}.`, 'info');
      loadStudents();
    } catch {
      addToast('Failed to delete student.', 'error');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/students/import-template/', { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', 'AttendX_UCC_Students_Template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      addToast('Could not download CSV template.', 'error');
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) {
      addToast('Please select a .csv or .xlsx file to import.', 'error');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('create_accounts', createAccounts ? 'true' : 'false');
      const res = await api.post('/students/import/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      addToast('Student records imported successfully!', 'success');
      loadStudents();
    } catch (err) {
      addToast(err.response?.data?.error || 'Import failed.', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#061430]">
            Student Records &amp; Academic Verification
          </h2>
          <p className="text-sm text-slate-500">
            Manage UCC student records, import CSV/Excel university lists, verify academic
            placement, and control account status
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setImportResult(null);
              setImportFile(null);
              setImportModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50 text-[#061430] border border-slate-200 text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
          >
            <Upload className="w-4 h-4 text-blue-700" />
            <span>Import CSV / Excel</span>
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-md transition hover:opacity-95 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
            }}
          >
            <Plus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Search & Multi-Facet Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search index number, name..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:border-blue-600"
          />
        </div>

        <select
          value={filterDept}
          onChange={(e) => {
            setFilterDept(e.target.value);
            setFilterProg('');
          }}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-600"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={filterProg}
          onChange={(e) => setFilterProg(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-600"
        >
          <option value="">All Programmes</option>
          {programmes
            .filter((p) => !filterDept || p.department === filterDept)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>

        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-600"
        >
          <option value="">All Levels</option>
          {['100', '200', '300', '400', '500', '600'].map((lvl) => (
            <option key={lvl} value={lvl}>
              Level {lvl}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-600"
        >
          <option value="">All Verification States</option>
          <option value="VERIFIED">Verified</option>
          <option value="PENDING">Pending Verification</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Index Number</th>
                <th className="py-3.5 px-5">Full Name &amp; Email</th>
                <th className="py-3.5 px-5">Department &amp; Programme</th>
                <th className="py-3.5 px-5">Level</th>
                <th className="py-3.5 px-5">Verification</th>
                <th className="py-3.5 px-5">Account</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">
                    Loading student records...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 text-sm">
                    No student records match the current filters.
                  </td>
                </tr>
              ) : (
                students.map((st) => {
                  const sp = st.student_profile || {};
                  const vStatus = sp.verification_status || 'PENDING';
                  return (
                    <tr key={st.id} className="hover:bg-blue-50/35 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-bold text-blue-700">
                        {sp.index_number || 'N/A'}
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="font-bold text-[#061430]">{st.full_name}</p>
                        <p className="text-xs text-slate-500">{st.email}</p>
                      </td>
                      <td className="py-3.5 px-5 text-xs">
                        <p className="font-semibold text-[#061430]">
                          {sp.programme_name || 'Unassigned'}
                        </p>
                        <p className="text-slate-500">{sp.department_name || '—'}</p>
                      </td>
                      <td className="py-3.5 px-5 font-mono font-bold text-[#061430]">
                        Level {sp.academic_level || '300'}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            vStatus === 'VERIFIED'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : vStatus === 'REJECTED'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {vStatus === 'VERIFIED' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : vStatus === 'REJECTED' ? (
                            <ShieldAlert className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {vStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            st.is_active
                              ? 'bg-blue-50 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {st.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right space-x-1.5">
                        <button
                          onClick={() => openEditModal(st)}
                          className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-50 cursor-pointer"
                          title="Update Academic Info"
                        >
                          <Edit3 className="w-4 h-4 inline" />
                        </button>
                        <button
                          onClick={() => toggleActive(st)}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                          title="Activate / Deactivate Account"
                        >
                          {st.is_active ? (
                            <ToggleRight className="w-5 h-5 text-blue-600 inline" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-slate-400 inline" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteStudent(st)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Delete Student"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Individual Student Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#040d21]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-[#061430]">
                Add &amp; Verify UCC Student
              </h3>
              <button onClick={() => setAddModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400 hover:text-red-600" />
              </button>
            </div>
            <form onSubmit={handleCreateStudent} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Awal Sarpong"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Index Number
                  </label>
                  <input
                    type="text"
                    required
                    value={form.index_number}
                    onChange={(e) =>
                      setForm({ ...form, index_number: e.target.value.toUpperCase() })
                    }
                    placeholder="PS/CSC/24/0044"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Level</label>
                  <select
                    value={form.academic_level}
                    onChange={(e) => setForm({ ...form, academic_level: e.target.value })}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Institutional Email
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="student@stu.ucc.edu.gh"
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
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Programme</label>
                <select
                  value={form.programme_id}
                  onChange={(e) => setForm({ ...form, programme_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  {programmes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
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
                  Add &amp; Verify Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Academic Information Modal */}
      {editStudent && (
        <div className="fixed inset-0 z-50 bg-[#040d21]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-[#061430]">
                Update Student Academic Record
              </h3>
              <button onClick={() => setEditStudent(null)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400 hover:text-red-600" />
              </button>
            </div>
            <form onSubmit={handleUpdateStudent} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Index Number
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.index_number}
                    onChange={(e) =>
                      setEditForm({ ...editForm, index_number: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Level</label>
                  <select
                    value={editForm.academic_level}
                    onChange={(e) => setEditForm({ ...editForm, academic_level: e.target.value })}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={editForm.department_id}
                  onChange={(e) => setEditForm({ ...editForm, department_id: e.target.value })}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Programme</label>
                <select
                  value={editForm.programme_id}
                  onChange={(e) => setEditForm({ ...editForm, programme_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  {programmes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Verification Status
                </label>
                <select
                  value={editForm.verification_status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, verification_status: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  <option value="VERIFIED">VERIFIED (Official UCC Record)</option>
                  <option value="PENDING">PENDING</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditStudent(null)}
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
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk CSV / Excel Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#040d21]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-700" />
                <h3 className="text-base font-extrabold text-[#061430]">
                  Import Verified Student Records (CSV / Excel)
                </h3>
              </div>
              <button onClick={() => setImportModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400 hover:text-red-600" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200/80 text-xs text-[#061430] space-y-2">
              <p>
                Upload an official <strong>.csv</strong> or <strong>.xlsx</strong> file with
                columns:{' '}
                <code className="font-mono font-bold">
                  index_number, full_name, email, department, programme, academic_level
                </code>
                .
              </p>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 text-blue-700 hover:text-red-600 font-bold underline cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample CSV Template</span>
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select CSV or Excel (.xlsx) File
                </label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xlsm"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createAccounts}
                  onChange={(e) => setCreateAccounts(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-700"
                />
                <span>
                  Automatically create verified student portal accounts when institutional email is
                  provided
                </span>
              </label>

              {importResult && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <p className="font-bold text-[#061430]">Import Summary:</p>
                  <p>Registry Records Created: {importResult.created_records}</p>
                  <p>Registry Records Updated: {importResult.updated_records}</p>
                  <p>Existing Student Profiles Verified: {importResult.synced_profiles}</p>
                  <p>New Student Accounts Created: {importResult.created_accounts}</p>
                  {importResult.errors?.length > 0 && (
                    <p className="text-red-600 font-semibold">
                      Warnings: {importResult.errors.join(' | ')}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={importing}
                  className="px-5 py-2 rounded-xl text-white font-bold text-xs cursor-pointer disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 65%, #dc2626 100%)',
                  }}
                >
                  {importing ? 'Importing...' : 'Upload & Verify Records'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageStudents;
