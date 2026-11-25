import React, { useState, useEffect } from 'react';
import { History, CheckCircle2, Search } from 'lucide-react';
import api from '../../services/api';

const StudentHistory = () => {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/students/history/')
      .then((res) => setRecords(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = records.filter(
    (r) =>
      r.course_code?.toLowerCase().includes(search.toLowerCase()) ||
      r.course_title?.toLowerCase().includes(search.toLowerCase()) ||
      r.session_title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Attendance History</h2>
          <p className="text-sm text-slate-500">
            Complete timestamped log of your verified classroom attendance records
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by course or topic..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading history...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <History className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No matching attendance records</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Course</th>
                  <th className="py-3.5 px-5">Lecture Session</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Method</th>
                  <th className="py-3.5 px-5">Verified Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
                {filtered.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-5">
                      <span className="font-mono font-bold text-indigo-600">{rec.course_code}</span>
                      <p className="text-xs text-slate-500">{rec.course_title}</p>
                    </td>
                    <td className="py-3.5 px-5 font-medium text-slate-800">{rec.session_title}</td>
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-xs text-slate-600">
                      {rec.verification_method}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-xs text-slate-500">
                      {new Date(rec.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentHistory;

