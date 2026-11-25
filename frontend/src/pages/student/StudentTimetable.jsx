import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, MapPin, User, Search, Sparkles } from 'lucide-react';
import api from '../../services/api';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY_LABELS = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

const STATUS_BADGE = {
  SCHEDULED: 'bg-blue-500/20 text-blue-200 border-blue-400/30',
  RESCHEDULED: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
  CANCELLED: 'bg-red-500/20 text-red-200 border-red-400/30 line-through',
};

const fmtTime = (t) => (t ? String(t).slice(0, 5) : '--:--');

export default function StudentTimetable() {
  const [schedules, setSchedules] = useState([]);
  const [nextLecture, setNextLecture] = useState(null);
  const [viewMode, setViewMode] = useState('weekly');
  const [selectedDay, setSelectedDay] = useState('MONDAY');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTimetable = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const [schedRes, nextRes] = await Promise.all([
        api.get('/academics/schedules/', { params }),
        api.get('/academics/timetable/next/'),
      ]);
      setSchedules(schedRes.data || []);
      setNextLecture(nextRes.data || null);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadTimetable();
  }, [loadTimetable]);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const jsDayToEnum = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

  return (
    <div className="space-y-6 text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#061430]/80 backdrop-blur-xl border border-white/15 rounded-2xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-red-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Calendar className="w-4 h-4" />
            <span>Personal Academic Schedule</span>
          </div>
          <h1 className="text-2xl font-bold text-white">My Lecture Timetable</h1>
          <p className="text-sm text-blue-100/70 mt-1">
            View your enrolled course lectures, venues, and real-time schedule updates.
          </p>
        </div>

        <div className="inline-flex bg-[#0b1f48] border border-white/15 rounded-xl p-1 self-start">
          {['weekly', 'daily', 'monthly', 'list'].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                viewMode === mode ? 'bg-red-600 text-white' : 'text-blue-100/70 hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Next Upcoming Lecture Highlight */}
      {nextLecture && (
        <div className="bg-gradient-to-r from-blue-900/80 via-[#0b2354]/90 to-red-900/60 border border-blue-400/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Sparkles className="w-4 h-4" />
              <span>Next Upcoming Lecture</span>
            </div>
            <h2 className="text-xl font-bold text-white">
              {nextLecture.course_code} — {nextLecture.course_title}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-sm text-blue-100/90 pt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-300" />
                {nextLecture.day_of_week}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-300" />
                {fmtTime(nextLecture.start_time)} – {fmtTime(nextLecture.end_time)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-red-300" />
                {nextLecture.venue_display}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-200" />
                {nextLecture.lecturer_name}
              </span>
            </div>
          </div>
          <span
            className={`self-start md:self-center text-xs font-bold px-3 py-1 rounded-full border ${
              STATUS_BADGE[nextLecture.status] || STATUS_BADGE.SCHEDULED
            }`}
          >
            {nextLecture.status}
          </span>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 bg-[#061430]/75 border border-white/15 rounded-2xl p-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-blue-300/60 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Filter by course code, title, lecturer, or venue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-blue-200/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
        >
          <option value="">All Statuses</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="RESCHEDULED">Rescheduled</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="p-12 text-center text-blue-200/70 bg-[#061430]/60 rounded-2xl border border-white/10">
          Loading your timetable...
        </div>
      ) : viewMode === 'weekly' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
          {DAYS.map((day) => {
            const items = schedules.filter((s) => s.day_of_week === day);
            return (
              <div
                key={day}
                className="bg-[#061430]/75 border border-white/15 rounded-2xl p-3 min-h-[240px] flex flex-col"
              >
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
                  <span className="text-xs font-bold uppercase text-blue-200">{DAY_LABELS[day]}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10">{items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {items.length === 0 ? (
                    <p className="text-xs text-blue-200/40 italic text-center mt-8">Free day</p>
                  ) : (
                    items.map((s) => (
                      <div key={s.id} className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-red-300">{s.course_code}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_BADGE[s.status]}`}>
                            {s.status}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-white">{s.course_title}</p>
                        <div className="text-[11px] text-blue-200/80 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-300" />
                          {fmtTime(s.start_time)} - {fmtTime(s.end_time)}
                        </div>
                        <div className="text-[11px] text-blue-200/80 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-red-300" />
                          {s.venue_display}
                        </div>
                        <p className="text-[11px] text-blue-200/60 truncate">{s.lecturer_name}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'daily' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  selectedDay === d
                    ? 'bg-blue-700 text-white'
                    : 'bg-[#061430]/75 text-blue-100/70 border border-white/10'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedules
              .filter((s) => s.day_of_week === selectedDay)
              .map((s) => (
                <div key={s.id} className="bg-[#061430]/80 border border-white/15 rounded-2xl p-5 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-red-300">{s.course_code}</span>
                      <h3 className="text-base font-bold text-white">{s.course_title}</h3>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_BADGE[s.status]}`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="text-sm text-blue-100/80 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-300" />
                    {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                  </div>
                  <div className="text-sm text-blue-100/80 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-red-300" />
                    {s.venue_display}
                  </div>
                  <div className="text-sm text-blue-100/80 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-200" />
                    {s.lecturer_name}
                  </div>
                  {s.notes && <p className="text-xs text-amber-200/90 pt-1">{s.notes}</p>}
                </div>
              ))}
          </div>
        </div>
      ) : viewMode === 'monthly' ? (
        <div className="bg-[#061430]/80 border border-white/15 rounded-2xl p-5 space-y-4">
          <h3 className="text-lg font-bold text-white">{monthName}</h3>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((dayNum) => {
              const dateObj = new Date(year, month, dayNum);
              const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayEnum = jsDayToEnum[dateObj.getDay()];
              const daySchedules = schedules.filter(
                (s) => s.lecture_date === isoDate || (!s.lecture_date && s.day_of_week === dayEnum)
              );
              return (
                <div key={dayNum} className="min-h-[88px] p-2 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-xs font-bold text-blue-200">{dayNum}</span>
                  {daySchedules.slice(0, 3).map((s) => (
                    <div key={s.id} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-700/60 truncate">
                      {s.course_code} {fmtTime(s.start_time)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-[#061430]/80 border border-white/15 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-blue-200 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Day & Time</th>
                <th className="px-4 py-3">Venue</th>
                <th className="px-4 py-3">Lecturer</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {schedules.map((s) => (
                <tr key={s.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="font-bold text-red-300">{s.course_code}</div>
                    <div className="text-xs text-blue-100/70">{s.course_title}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{s.day_of_week}</div>
                    <div className="text-xs text-blue-200/70">
                      {fmtTime(s.start_time)} - {fmtTime(s.end_time)}
                    </div>
                  </td>
                  <td className="px-4 py-3">{s.venue_display}</td>
                  <td className="px-4 py-3">{s.lecturer_name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border ${STATUS_BADGE[s.status]}`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
              {schedules.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-blue-200/60">
                    No scheduled lectures found for your enrolled courses.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

