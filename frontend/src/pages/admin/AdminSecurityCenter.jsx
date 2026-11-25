import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Activity,
  Database,
  FileSearch,
  Users,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Lock,
  Unlock,
  LogOut,
  Plus,
} from 'lucide-react';
import api from '../../services/api';

export default function AdminSecurityCenter() {
  const [activeTab, setActiveTab] = useState('health');
  const [health, setHealth] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);

  const [auditFilters, setAuditFilters] = useState({
    search: '',
    action: '',
    role: '',
    date_from: '',
    date_to: '',
  });

  const showBanner = (type, message) => {
    setBanner({ type, message });
    setTimeout(() => setBanner(null), 6000);
  };

  const loadHealth = useCallback(async () => {
    try {
      const res = await api.get('/reports/system-health/');
      setHealth(res.data);
    } catch {
      showBanner('error', 'Failed to fetch live system health.');
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    try {
      const params = {};
      Object.entries(auditFilters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      const res = await api.get('/auth/audit-logs/', { params });
      setAuditLogs(res.data || []);
    } catch {
      // ignore
    }
  }, [auditFilters]);

  const loadSessionsAndUsers = useCallback(async () => {
    try {
      const [sRes, uRes, dRes] = await Promise.all([
        api.get('/auth/sessions/?all=true&active_only=true'),
        api.get('/auth/users/'),
        api.get('/academics/departments/'),
      ]);
      setSessions(sRes.data || []);
      setUsers(uRes.data || []);
      setDepartments(dRes.data || []);
    } catch {
      // ignore
    }
  }, []);

  const loadBackups = useCallback(async () => {
    try {
      const res = await api.get('/reports/backups/');
      setBackups(res.data || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadHealth(), loadAuditLogs(), loadSessionsAndUsers(), loadBackups()]);
      setLoading(false);
    };
    init();
  }, [loadHealth, loadAuditLogs, loadSessionsAndUsers, loadBackups]);

  const handleExportAuditCsv = async () => {
    try {
      const res = await api.get('/auth/audit-logs/', {
        params: { ...auditFilters, export: 'csv' },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'attendx_security_audit_logs.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      showBanner('error', 'Failed to export audit logs CSV.');
    }
  };

  const handleRevokeSession = async (id) => {
    try {
      await api.post(`/auth/sessions/${id}/revoke/`);
      showBanner('success', 'Session revoked and token blacklisted.');
      loadSessionsAndUsers();
    } catch {
      showBanner('error', 'Could not revoke session.');
    }
  };

  const handleToggleSuspend = async (u) => {
    try {
      const next = !u.is_suspended;
      await api.patch(`/auth/users/${u.id}/`, { is_suspended: next });
      showBanner('success', `${u.email} ${next ? 'suspended' : 'reactivated'}.`);
      loadSessionsAndUsers();
    } catch {
      showBanner('error', 'Failed to update account suspension.');
    }
  };

  const handleRoleUpdate = async (u, role, assigned_department = u.assigned_department) => {
    try {
      await api.patch(`/auth/users/${u.id}/`, {
        role,
        assigned_department: role === 'DEPT_ADMIN' ? assigned_department : null,
      });
      showBanner('success', `Updated permissions for ${u.email}.`);
      loadSessionsAndUsers();
    } catch {
      showBanner('error', 'Failed to update user role.');
    }
  };

  const handleCreateBackup = async () => {
    try {
      const res = await api.post('/reports/backups/', { notes: 'Manual Admin Control Centre backup' });
      showBanner('success', res.data?.message || 'Backup created.');
      loadBackups();
    } catch {
      showBanner('error', 'Failed to create database backup.');
    }
  };

  const handleVerifyBackup = async (id) => {
    try {
      const res = await api.post(`/reports/backups/${id}/verify/`);
      showBanner(res.data?.verified ? 'success' : 'error', res.data?.message);
      loadBackups();
    } catch {
      showBanner('error', 'Backup verification failed.');
    }
  };

  const handleDeleteBackup = async (id) => {
    if (!window.confirm('Delete this backup file permanently?')) return;
    try {
      await api.delete(`/reports/backups/${id}/`);
      showBanner('success', 'Backup deleted.');
      loadBackups();
    } catch {
      showBanner('error', 'Failed to delete backup.');
    }
  };

  return (
    <div className="space-y-6 text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#061430]/85 border border-white/15 rounded-2xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-red-400 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Phase 8 • Security & System Administration</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Security, Monitoring & Backup Control Centre</h1>
          <p className="text-sm text-blue-100/70 mt-1">
            Monitor live system health, inspect immutable security audit logs, manage active sessions, and verify database backups.
          </p>
        </div>
        <button
          onClick={() => {
            loadHealth();
            loadAuditLogs();
            loadSessionsAndUsers();
            loadBackups();
          }}
          className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-sm font-semibold flex items-center gap-2 self-start"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Telemetry
        </button>
      </div>

      {banner && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
            banner.type === 'error'
              ? 'bg-red-950/75 border-red-500/40 text-red-100'
              : 'bg-emerald-950/75 border-emerald-500/40 text-emerald-100'
          }`}
        >
          {banner.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{banner.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-[#061430]/80 border border-white/15 rounded-xl p-1.5">
        {[
          { id: 'health', label: 'System Health & Monitoring', icon: Activity },
          { id: 'audit', label: `Security Audit Logs (${auditLogs.length})`, icon: FileSearch },
          { id: 'sessions', label: `Sessions & RBAC (${sessions.length})`, icon: Users },
          { id: 'backups', label: `Database Backups (${backups.length})`, icon: Database },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
                active ? 'bg-red-600 text-white shadow' : 'text-blue-100/70 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="p-12 text-center text-blue-200/70 bg-[#061430]/70 rounded-2xl border border-white/10">
          Loading security telemetry...
        </div>
      ) : activeTab === 'health' && health ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#061430]/80 border border-white/15 rounded-2xl p-5">
              <span className="text-xs font-bold text-blue-300 uppercase">Backend & Database</span>
              <p className="text-2xl font-extrabold mt-2 text-emerald-300">
                {health.system_health.backend_status}
              </p>
              <p className="text-xs text-blue-100/70 mt-1">
                DB Latency: {health.system_health.database_latency_ms ?? '--'} ms
              </p>
            </div>
            <div className="bg-[#061430]/80 border border-white/15 rounded-2xl p-5">
              <span className="text-xs font-bold text-blue-300 uppercase">API Performance</span>
              <p className="text-2xl font-extrabold mt-2 text-white">
                {health.performance.avg_response_ms} ms
              </p>
              <p className="text-xs text-blue-100/70 mt-1">
                {health.performance.total_api_requests} requests • {health.performance.error_rate_percent}% 5xx
              </p>
            </div>
            <div className="bg-[#061430]/80 border border-white/15 rounded-2xl p-5">
              <span className="text-xs font-bold text-blue-300 uppercase">Active Users & Sessions</span>
              <p className="text-2xl font-extrabold mt-2 text-white">
                {health.usage_statistics.total_active_users}
              </p>
              <p className="text-xs text-blue-100/70 mt-1">
                {health.usage_statistics.active_sessions} sessions ({health.usage_statistics.mobile_sessions} mobile /{' '}
                {health.usage_statistics.web_sessions} web)
              </p>
            </div>
            <div className="bg-[#061430]/80 border border-white/15 rounded-2xl p-5">
              <span className="text-xs font-bold text-red-300 uppercase">24h Security & Errors</span>
              <p className="text-2xl font-extrabold mt-2 text-red-300">
                {health.error_monitoring.failed_logins_24h} failed logins
              </p>
              <p className="text-xs text-blue-100/70 mt-1">
                {health.error_monitoring.failed_emails_24h} failed emails •{' '}
                {health.usage_statistics.daily_logins} logins today
              </p>
            </div>
          </div>

          <div className="bg-[#061430]/80 border border-white/15 rounded-2xl p-5">
            <h3 className="text-base font-bold mb-3">Recent Application Errors</h3>
            {health.error_monitoring.recent_errors.length === 0 ? (
              <p className="text-sm text-emerald-300/80">No HTTP 500 server errors recorded since startup.</p>
            ) : (
              <div className="space-y-2">
                {health.error_monitoring.recent_errors.map((e, i) => (
                  <div key={i} className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs">
                    <strong>{e.method} {e.path}</strong> — {e.error} ({new Date(e.timestamp).toLocaleString()})
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'audit' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-[#061430]/80 border border-white/15 rounded-2xl p-4">
            <input
              type="text"
              placeholder="Search email, IP, description..."
              value={auditFilters.search}
              onChange={(e) => setAuditFilters((f) => ({ ...f, search: e.target.value }))}
              className="md:col-span-2 px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-sm text-white"
            />
            <select
              value={auditFilters.action}
              onChange={(e) => setAuditFilters((f) => ({ ...f, action: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
            >
              <option value="">All Actions</option>
              {[
                'LOGIN_SUCCESS',
                'LOGIN_FAILED',
                'ACCOUNT_LOCKED',
                'SUSPICIOUS_LOGIN',
                'LOGOUT',
                'PASSWORD_CHANGED',
                'PASSWORD_RESET',
                'SESSION_REVOKED',
                'ROLE_CHANGED',
                'ACCOUNT_SUSPENDED',
                'COURSE_MODIFIED',
                'BACKUP_EVENT',
              ].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <input
              type="date"
              value={auditFilters.date_from}
              onChange={(e) => setAuditFilters((f) => ({ ...f, date_from: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
            />
            <button
              onClick={handleExportAuditCsv}
              className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-sm font-bold flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          <div className="bg-[#061430]/80 border border-white/15 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-blue-200 uppercase">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 whitespace-nowrap text-blue-200/70">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{log.actor_email || 'Anonymous'}</div>
                        <div className="text-[11px] text-blue-300">{log.actor_role}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-blue-100">{log.description}</td>
                      <td className="px-4 py-3 text-blue-200/70">{log.ip_address || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'sessions' ? (
        <div className="space-y-6">
          <div className="bg-[#061430]/80 border border-white/15 rounded-2xl p-5 space-y-3">
            <h3 className="text-base font-bold">Active User Sessions</h3>
            {sessions.length === 0 ? (
              <p className="text-sm text-blue-200/60">No active sessions recorded.</p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-sm font-bold text-white">
                      {s.user_name} ({s.user_email}) • <span className="text-red-300">{s.user_role}</span>
                    </div>
                    <div className="text-xs text-blue-200/70">
                      {s.device_name} ({s.platform}) • IP: {s.ip_address || 'unknown'} • Started:{' '}
                      {new Date(s.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeSession(s.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold flex items-center gap-1 self-start"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="bg-[#061430]/80 border border-white/15 rounded-2xl p-5 space-y-3">
            <h3 className="text-base font-bold">Role & Account Governance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-blue-200 uppercase">
                  <tr>
                    <th className="px-3 py-2.5">User</th>
                    <th className="px-3 py-2.5">Role</th>
                    <th className="px-3 py-2.5">Dept Admin Scope</th>
                    <th className="px-3 py-2.5 text-right">Suspension</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {users.slice(0, 50).map((u) => (
                    <tr key={u.id}>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-white">{u.full_name}</div>
                        <div className="text-blue-200/70">{u.email}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleUpdate(u, e.target.value)}
                          className="px-2 py-1 rounded bg-[#0b1f48] border border-white/15 text-white"
                        >
                          <option value="STUDENT">STUDENT</option>
                          <option value="LECTURER">LECTURER</option>
                          <option value="DEPT_ADMIN">DEPT_ADMIN</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        {u.role === 'DEPT_ADMIN' ? (
                          <select
                            value={u.assigned_department || ''}
                            onChange={(e) => handleRoleUpdate(u, 'DEPT_ADMIN', e.target.value)}
                            className="px-2 py-1 rounded bg-[#0b1f48] border border-white/15 text-white"
                          >
                            <option value="">Select department...</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-blue-200/50">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => handleToggleSuspend(u)}
                          className={`px-3 py-1 rounded-lg font-bold inline-flex items-center gap-1 ${
                            u.is_suspended
                              ? 'bg-emerald-600 hover:bg-emerald-500'
                              : 'bg-red-600/80 hover:bg-red-600'
                          }`}
                        >
                          {u.is_suspended ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          {u.is_suspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#061430]/80 border border-white/15 rounded-2xl p-5">
            <div>
              <h3 className="text-base font-bold">Encrypted/Private Database Backups</h3>
              <p className="text-xs text-blue-200/70">
                Stored in private non-public storage (`backend/private_backups/`). CLI recovery:{' '}
                <code>python manage.py backup_database</code>
              </p>
            </div>
            <button
              onClick={handleCreateBackup}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-blue-700 text-sm font-bold flex items-center gap-2 self-start"
            >
              <Plus className="w-4 h-4" />
              Create Backup Now
            </button>
          </div>

          <div className="space-y-3">
            {backups.map((b) => (
              <div
                key={b.id}
                className="bg-[#061430]/80 border border-white/15 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{b.filename}</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                        b.status === 'VERIFIED'
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : b.status === 'FAILED'
                          ? 'bg-red-500/20 text-red-200'
                          : 'bg-blue-500/20 text-blue-200'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <p className="text-xs text-blue-200/70 mt-1">
                    {b.backup_format} • {(b.size_bytes / 1024).toFixed(1)} KB • SHA-256:{' '}
                    <code>{b.sha256_checksum.slice(0, 16)}...</code>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVerifyBackup(b.id)}
                    className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-xs font-bold"
                  >
                    Verify Integrity
                  </button>
                  <button
                    onClick={() => handleDeleteBackup(b.id)}
                    className="p-2 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

