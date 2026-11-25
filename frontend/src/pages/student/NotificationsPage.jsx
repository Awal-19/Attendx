import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Radio,
  Info,
  Trash2,
  Sliders,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const CATEGORIES = [
  { key: 'ALL', label: 'All' },
  { key: 'ATTENDANCE', label: 'Attendance' },
  { key: 'ACADEMIC', label: 'Academic' },
  { key: 'ADMIN_MESSAGE', label: 'Admin Messages' },
  { key: 'SYSTEM', label: 'System Updates' },
  { key: 'SECURITY', label: 'Security Alerts' },
];

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [category, setCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState({
    in_app_enabled: true,
    email_enabled: true,
    attendance_alerts: true,
    announcements_enabled: true,
    system_updates: true,
  });
  const { addToast } = useToast();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const qs = category !== 'ALL' ? `?category=${category}` : '';
      const res = await api.get(`/notifications/${qs}`);
      setNotifications(res.data.notifications || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    api
      .get('/notifications/preferences/')
      .then((res) => setPrefs(res.data))
      .catch(() => {});
  }, []);

  const markAllRead = async () => {
    try {
      await api.post('/notifications/');
      addToast('All notifications marked as read.', 'info');
      fetchNotifications();
    } catch {
      // ignore
    }
  };

  const markOneRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read/`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      // ignore
    }
  };

  const deleteNotification = async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}/`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      addToast('Notification dismissed.', 'info');
    } catch {
      // ignore
    }
  };

  const savePrefs = async (e) => {
    e.preventDefault();
    try {
      await api.patch('/notifications/preferences/', prefs);
      addToast('Notification preferences saved!', 'success');
      setShowPrefs(false);
    } catch {
      addToast('Could not save preferences.', 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#061430]">Notification Centre</h2>
          <p className="text-sm text-slate-500">
            Real-time attendance confirmations, alerts, announcements, and security notices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPrefs(!showPrefs)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-blue-50 text-xs font-bold text-[#061430] transition cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-blue-700" />
            <span>Preferences</span>
          </button>
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-xs font-bold text-white transition cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All Read</span>
          </button>
        </div>
      </div>

      {/* Preferences Panel */}
      {showPrefs && (
        <form
          onSubmit={savePrefs}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#061430]">Notification Preferences</h3>
            <span className="text-[11px] text-slate-500">
              Mandatory security alerts are always enabled
            </span>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 text-xs font-semibold text-slate-700">
            {[
              { key: 'in_app_enabled', label: 'In-App Notifications' },
              { key: 'email_enabled', label: 'Email Notifications' },
              { key: 'attendance_alerts', label: 'Attendance Alerts' },
              { key: 'announcements_enabled', label: 'Announcements' },
              { key: 'system_updates', label: 'System Updates' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs[item.key]}
                  onChange={(e) => setPrefs({ ...prefs, [item.key]: e.target.checked })}
                  className="w-4 h-4 accent-blue-700"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#061430] hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
          >
            Save Preferences
          </button>
        </form>
      )}

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              category === c.key
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
            <Bell className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">You’re all caught up!</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markOneRead(n.id)}
              className={`p-5 rounded-2xl border transition flex items-start gap-4 cursor-pointer ${
                n.is_read
                  ? 'bg-white border-slate-200/80 text-slate-600'
                  : 'bg-blue-50/70 border-blue-200 text-[#061430] shadow-xs'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  n.category === 'SECURITY' || n.notification_type === 'VERIFICATION_FAILED'
                    ? 'bg-red-100 text-red-600'
                    : n.notification_type === 'ATTENDANCE_CONFIRMED'
                    ? 'bg-blue-100 text-blue-700'
                    : n.notification_type === 'LOW_ATTENDANCE_WARNING' ||
                      n.notification_type === 'CONSECUTIVE_ABSENCE'
                    ? 'bg-amber-100 text-amber-700'
                    : n.notification_type === 'SESSION_STARTED'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {n.category === 'SECURITY' ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : n.notification_type === 'LOW_ATTENDANCE_WARNING' ||
                  n.notification_type === 'CONSECUTIVE_ABSENCE' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : n.notification_type === 'ATTENDANCE_CONFIRMED' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : n.notification_type === 'SESSION_STARTED' ? (
                  <Radio className="w-5 h-5" />
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[#061430]">{n.title}</h4>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                      {n.category}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!n.is_read && <span className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                <button
                  onClick={(e) => deleteNotification(e, n.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                  title="Dismiss"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
