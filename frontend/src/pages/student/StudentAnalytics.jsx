import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import api from '../../services/api';

const StudentAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/students/dashboard/')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-80 bg-slate-200 rounded-2xl animate-pulse" />;
  }

  const courses = data?.course_summaries || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">Attendance Analytics</h2>
        <p className="text-sm text-slate-500">
          Visual breakdown of your course attendance percentages against UCC’s 75% exam eligibility
          threshold
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900">
          Attendance Percentage by Registered Course
        </h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={courses} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="code" tick={{ fontSize: 12, fontWeight: 600 }} />
              <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [`${value}%`, 'Attendance Rate']}
                contentStyle={{ borderRadius: '12px', border: '1px solid #cbd5e1' }}
              />
              <Bar dataKey="attendance_percentage" radius={[8, 8, 0, 0]}>
                {courses.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.attendance_percentage >= 75 ? '#4f46e5' : '#e11d48'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((c) => (
          <div
            key={c.course_id}
            className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-indigo-50 text-indigo-700">
                {c.code}
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  c.attendance_status === 'Excellent attendance' || c.attendance_status === 'Good attendance'
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : c.attendance_status === 'Warning'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {c.attendance_status || (c.attendance_percentage >= 75 ? 'Good attendance' : 'Critical attendance')}
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">{c.title}</h4>
            <div className="pt-2 grid grid-cols-3 gap-2 text-center border-t border-slate-100 text-xs">
              <div>
                <p className="text-slate-400">Sessions</p>
                <p className="font-bold text-slate-800">{c.total_sessions}</p>
              </div>
              <div>
                <p className="text-slate-400">Attended</p>
                <p className="font-bold text-emerald-600">{c.attended_sessions}</p>
              </div>
              <div>
                <p className="text-slate-400">Missed</p>
                <p className="font-bold text-rose-600">{c.missed_sessions}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudentAnalytics;

