import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import api from '../../services/api';

const LecturerHistory = () => {
  const [sessions, setSessions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [tab, setTab] = useState('sessions');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/attendance/sessions/'), api.get('/attendance/audit-logs/')])
      .then(([sRes, aRes]) => {
        setSessions(sRes.data);
        setAuditLogs(aRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#061430]">
            Attendance Sessions &amp; Immutable Audit Trail
          </h2>
          <p className="text-sm text-slate-500">
            Review past lecture sessions and inspect every manual attendance edit with actor and
            reason logs
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-200/80 p-1">
          <button
            onClick={() => setTab('sessions')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              tab === 'sessions'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-[#061430]'
            }`}
          >
            Lecture Sessions ({sessions.length})
          </button>
          <button
            onClick={() => setTab('audit')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              tab === 'audit'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-[#061430]'
            }`}
          >
            Security Audit Log ({auditLogs.length})
          </button>
        </div>
      </div>

      {tab === 'sessions' ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Course</th>
                  <th className="py-3.5 px-5">Lecture Title</th>
                  <th className="py-3.5 px-5">Venue</th>
                  <th className="py-3.5 px-5">Start Time</th>
                  <th className="py-3.5 px-5">Turnout</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3.5 px-5 font-mono font-bold text-blue-700">
                      {s.course_code}
                    </td>
                    <td className="py-3.5 px-5 font-bold text-[#061430]">{s.title}</td>
                    <td className="py-3.5 px-5 text-slate-600">{s.venue}</td>
                    <td className="py-3.5 px-5 font-mono text-xs text-slate-500">
                      {new Date(s.start_time).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="font-bold text-[#061430]">
                        {s.present_count}/{s.enrolled_count}
                      </span>{' '}
                      <span className="text-xs text-slate-500">({s.attendance_rate}%)</span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          s.status === 'ACTIVE'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200/60'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <Link
                        to={`/lecturer/live-session?session=${s.id}`}
                        className="text-xs font-bold text-blue-700 hover:text-red-600 transition-colors"
                      >
                        Open Roster / Edit →
                      </Link>
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
                  <th className="py-3.5 px-5">Action</th>
                  <th className="py-3.5 px-5">Actor</th>
                  <th className="py-3.5 px-5">Course &amp; Session</th>
                  <th className="py-3.5 px-5">Target Student</th>
                  <th className="py-3.5 px-5">Change</th>
                  <th className="py-3.5 px-5">Reason</th>
                  <th className="py-3.5 px-5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200/70">
                        <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-[#061430]">{log.actor_name}</td>
                    <td className="py-3.5 px-5">
                      <span className="font-mono font-bold text-blue-700">{log.course_code}</span>
                      <p className="text-xs text-slate-500">{log.session_title}</p>
                    </td>
                    <td className="py-3.5 px-5">
                      {log.target_student_name ? (
                        <>
                          <p className="font-bold text-[#061430]">{log.target_student_name}</p>
                          <p className="font-mono text-xs text-slate-500">
                            {log.target_student_index}
                          </p>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-xs">
                      {log.previous_value ? `${log.previous_value} → ` : ''}
                      <span className="font-bold text-blue-700">{log.new_value}</span>
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-600">{log.reason}</td>
                    <td className="py-3.5 px-5 font-mono text-xs text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerHistory;
