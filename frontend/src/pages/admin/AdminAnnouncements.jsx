import React, { useState, useEffect, useCallback } from 'react';
import { Radio, Plus, Send, Trash2, X, Mail } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const AdminAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const { addToast } = useToast();

  const [form, setForm] = useState({
    title: '',
    message: '',
    category: 'ADMIN_MESSAGE',
    target_type: 'ALL_USERS',
    target_department: '',
    target_programme: '',
    target_course: '',
    send_email: false,
    publish_now: true,
    scheduled_for: '',
  });

  const loadData = useCallback(async () => {
    try {
      const [aRes, dRes, pRes, cRes] = await Promise.all([
        api.get('/notifications/announcements/'),
        api.get('/academics/departments/'),
        api.get('/academics/programmes/'),
        api.get('/courses/'),
      ]);
      setAnnouncements(aRes.data);
      setDepartments(dRes.data);
      setProgrammes(pRes.data);
      setCourses(cRes.data);
    } catch {
      addToast('Failed to load announcements.', 'error');
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/notifications/announcements/', form);
      addToast(res.data.message, 'success');
      setModalOpen(false);
      setForm({
        title: '',
        message: '',
        category: 'ADMIN_MESSAGE',
        target_type: 'ALL_USERS',
        target_department: '',
        target_programme: '',
        target_course: '',
        send_email: false,
        publish_now: true,
        scheduled_for: '',
      });
      loadData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not create announcement.', 'error');
    }
  };

  const handlePublish = async (id) => {
    try {
      const res = await api.post(`/notifications/announcements/${id}/publish/`);
      addToast(res.data.message, 'success');
      loadData();
    } catch {
      addToast('Failed to publish announcement.', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/notifications/announcements/${id}/`);
      addToast('Announcement deleted.', 'info');
      loadData();
    } catch {
      addToast('Failed to delete announcement.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#061430]">
            University Announcements &amp; Broadcasts
          </h2>
          <p className="text-sm text-slate-500">
            Publish or schedule targeted announcements to students, lecturers, departments,
            programmes, or courses
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-md cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
          }}
        >
          <Plus className="w-4 h-4" />
          <span>New Announcement</span>
        </button>
      </div>

      <div className="space-y-3">
        {announcements.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
            <Radio className="w-8 h-8 text-blue-700 mx-auto" />
            <p className="text-sm font-bold text-[#061430]">No announcements created yet</p>
          </div>
        ) : (
          announcements.map((a) => (
            <div
              key={a.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      a.status === 'PUBLISHED'
                        ? 'bg-blue-50 text-blue-800 border border-blue-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {a.status}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                    {a.target_type}
                  </span>
                  {a.send_email && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600">
                      <Mail className="w-3 h-3" /> Email Enabled
                    </span>
                  )}
                </div>
                <h3 className="text-base font-extrabold text-[#061430]">{a.title}</h3>
                <p className="text-xs text-slate-600">{a.message}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {a.status !== 'PUBLISHED' && (
                  <button
                    onClick={() => handlePublish(a.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Publish Now</span>
                  </button>
                )}
                <button
                  onClick={() => handleDelete(a.id)}
                  className="p-2 rounded-xl text-red-600 hover:bg-red-50 cursor-pointer"
                  title="Delete Announcement"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-[#040d21]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-[#061430]">
                Create University Announcement
              </h3>
              <button onClick={() => setModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400 hover:text-red-600" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Message</label>
                <textarea
                  rows={3}
                  required
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  >
                    <option value="ADMIN_MESSAGE">Administrative Message</option>
                    <option value="ACADEMIC">Academic Announcement</option>
                    <option value="SYSTEM">System Update</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Recipients
                  </label>
                  <select
                    value={form.target_type}
                    onChange={(e) => setForm({ ...form, target_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  >
                    <option value="ALL_USERS">All Users</option>
                    <option value="ALL_STUDENTS">All Students</option>
                    <option value="ALL_LECTURERS">All Lecturers</option>
                    <option value="DEPARTMENT">Specific Department</option>
                    <option value="PROGRAMME">Specific Programme</option>
                    <option value="COURSE">Specific Course</option>
                  </select>
                </div>
              </div>

              {form.target_type === 'DEPARTMENT' && (
                <select
                  value={form.target_department}
                  onChange={(e) => setForm({ ...form, target_department: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}

              {form.target_type === 'PROGRAMME' && (
                <select
                  value={form.target_programme}
                  onChange={(e) => setForm({ ...form, target_programme: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="">Select Programme</option>
                  {programmes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}

              {form.target_type === 'COURSE' && (
                <select
                  value={form.target_course}
                  onChange={(e) => setForm({ ...form, target_course: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="">Select Course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex flex-wrap gap-4 pt-1 text-xs font-semibold text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.send_email}
                    onChange={(e) => setForm({ ...form, send_email: e.target.checked })}
                    className="w-4 h-4 accent-blue-700"
                  />
                  <span>Also send Email Notification</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.publish_now}
                    onChange={(e) => setForm({ ...form, publish_now: e.target.checked })}
                    className="w-4 h-4 accent-blue-700"
                  />
                  <span>Publish Immediately</span>
                </label>
              </div>

              {!form.publish_now && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Schedule For (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_for}
                    onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              )}

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
                  {form.publish_now ? 'Publish Announcement' : 'Schedule / Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAnnouncements;

