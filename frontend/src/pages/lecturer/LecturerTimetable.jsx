import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Radio,
  Sparkles,
  Send,
  X,
  CheckCircle2,
  AlertTriangle,
  Users,
} from 'lucide-react';
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

const REQ_BADGE = {
  PENDING: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
  APPROVED: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
  REJECTED: 'bg-red-500/20 text-red-200 border-red-400/30',
};

const fmtTime = (t) => (t ? String(t).slice(0, 5) : '--:--');

export default function LecturerTimetable() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [nextLecture, setNextLecture] = useState(null);
  const [venues, setVenues] = useState([]);
  const [requests, setRequests] = useState([]);
  const [viewMode, setViewMode] = useState('weekly');
  const [selectedDay, setSelectedDay] = useState('MONDAY');
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);

  // Change request modal
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [reqTarget, setReqTarget] = useState(null);
  const [reqForm, setReqForm] = useState({
    requested_day: 'MONDAY',
    requested_start_time: '08:30',
    requested_end_time: '10:30',
    requested_venue: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, nextRes, venueRes, reqRes] = await Promise.all([
        api.get('/academics/schedules/'),
        api.get('/academics/timetable/next/'),
        api.get('/academics/venues/'),
        api.get('/academics/schedule-requests/'),
      ]);
      setSchedules(schedRes.data || []);
      setNextLecture(nextRes.data || null);
      setVenues(venueRes.data || []);
      setRequests(reqRes.data || []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const startQrSession = (s) => {
    navigate(`/lecturer/live-session?course=${s.course}&schedule=${s.id}`);
  };

  const openRequestModal = (s) => {
    setReqTarget(s);
    setReqForm({
      requested_day: s.day_of_week,
      requested_start_time: fmtTime(s.start_time),
      requested_end_time: fmtTime(s.end_time),
      requested_venue: s.venue_obj || '',
      reason: '',
    });
    setReqModalOpen(true);
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!reqTarget) return;
    setSubmitting(true);
    try {
      await api.post('/academics/schedule-requests/', {
        schedule: reqTarget.id,
        ...reqForm,
        requested_venue: reqForm.requested_venue || null,
      });
      setReqModalOpen(false);
      setBanner({ type: 'success', message: 'Schedule change request submitted to administration.' });
      loadData();
    } catch (err) {
      setBanner({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to submit schedule change request.',
      });
    } finally {
      setSubmitting(false);
    }
  };

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
            <span>Faculty Teaching Timetable</span>
          </div>
          <h1 className="text-2xl font-bold text-white">My Teaching Schedule</h1>
          <p className="text-sm text-blue-100/70 mt-1">
            View assigned lecture slots, launch Dynamic QR attendance sessions directly, or request reschedules.
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

      {banner && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm ${
            banner.type === 'error'
              ? 'bg-red-950/70 border-red-500/40 text-red-100'
              : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-100'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{banner.message}</span>
          </div>
          <button onClick={() => setBanner(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Next Lecture Quick-Launch */}
      {nextLecture && (
        <div className="bg-gradient-to-r from-blue-900/80 via-[#0b2354]/90 to-red-900/60 border border-blue-400/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Sparkles className="w-4 h-4" />
              <span>Next Scheduled Lecture</span>
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
                <Users className="w-4 h-4 text-blue-200" />
                {nextLecture.enrolled_count} enrolled
              </span>
            </div>
          </div>

          {nextLecture.status !== 'CANCELLED' && (
            <button
              onClick={() => startQrSession(nextLecture)}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-red-600 to-blue-700 hover:from-red-500 hover:to-blue-600 text-sm font-bold flex items-center gap-2 shadow-lg shrink-0"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              Start QR Session
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-blue-200/70 bg-[#061430]/60 rounded-2xl border border-white/10">
          Loading teaching schedule...
        </div>
      ) : viewMode === 'weekly' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
          {DAYS.map((day) => {
            const items = schedules.filter((s) => s.day_of_week === day);
            return (
              <div
                key={day}
                className="bg-[#061430]/75 border border-white/15 rounded-2xl p-3 min-h-[250px] flex flex-col"
              >
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
                  <span className="text-xs font-bold uppercase text-blue-200">{DAY_LABELS[day]}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10">{items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {items.length === 0 ? (
                    <p className="text-xs text-blue-200/40 italic text-center mt-8">No lectures</p>
                  ) : (
                    items.map((s) => (
                      <div key={s.id} className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-red-300">{s.course_code}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_BADGE[s.status]}`}>
                            {s.status}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-white line-clamp-2">{s.course_title}</p>
                        <div className="text-[11px] text-blue-200/80 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-300" />
                          {fmtTime(s.start_time)} - {fmtTime(s.end_time)}
                        </div>
                        <div className="text-[11px] text-blue-200/80 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-red-300" />
                          {s.venue_display}
                        </div>
                        <div className="flex flex-col gap-1.5 pt-1 border-t border-white/10">
                          {s.status !== 'CANCELLED' && (
                            <button
                              onClick={() => startQrSession(s)}
                              className="w-full py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-[11px] font-bold flex items-center justify-center gap-1"
                            >
                              <Radio className="w-3 h-3" />
                              Start QR Session
                            </button>
                          )}
                          <button
                            onClick={() => openRequestModal(s)}
                            className="w-full py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-blue-100"
                          >
                            Request Change
                          </button>
                        </div>
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
                <div key={s.id} className="bg-[#061430]/80 border border-white/15 rounded-2xl p-5 space-y-3">
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
                  <div className="flex gap-2 pt-2 border-t border-white/10">
                    {s.status !== 'CANCELLED' && (
                      <button
                        onClick={() => startQrSession(s)}
                        className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold"
                      >
                        Start QR Session
                      </button>
                    )}
                    <button
                      onClick={() => openRequestModal(s)}
                      className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold"
                    >
                      Request Change
                    </button>
                  </div>
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
                    <div
                      key={s.id}
                      onClick={() => s.status !== 'CANCELLED' && startQrSession(s)}
                      className="cursor-pointer text-[10px] px-1.5 py-0.5 rounded bg-blue-700/60 hover:bg-blue-600 truncate"
                    >
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
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
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
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border ${STATUS_BADGE[s.status]}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {s.status !== 'CANCELLED' && (
                      <button
                        onClick={() => startQrSession(s)}
                        className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold"
                      >
                        Start QR
                      </button>
                    )}
                    <button
                      onClick={() => openRequestModal(s)}
                      className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
                    >
                      Request Change
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* My Submitted Change Requests */}
      {requests.length > 0 && (
        <div className="bg-[#061430]/80 border border-white/15 rounded-2xl p-5 space-y-3">
          <h3 className="text-base font-bold text-white">My Schedule Change Requests</h3>
          <div className="space-y-2">
            {requests.map((r) => (
              <div
                key={r.id}
                className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="text-xs font-bold text-red-300 mr-2">{r.course_code}</span>
                  <span className="text-sm font-semibold">
                    {r.requested_day} {fmtTime(r.requested_start_time)} - {fmtTime(r.requested_end_time)}
                  </span>
                  {r.requested_venue_name && (
                    <span className="text-xs text-blue-200/80 ml-2">@ {r.requested_venue_name}</span>
                  )}
                  <p className="text-xs text-blue-100/70 mt-0.5">{r.reason}</p>
                  {r.admin_notes && (
                    <p className="text-xs text-amber-200 mt-0.5">Admin Note: {r.admin_notes}</p>
                  )}
                </div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full border self-start ${REQ_BADGE[r.status]}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Schedule Change Modal */}
      {reqModalOpen && reqTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#07193d] border border-white/20 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                Request Change: {reqTarget.course_code}
              </h2>
              <button onClick={() => setReqModalOpen(false)} className="text-blue-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitRequest} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-blue-200 mb-1">Requested Day</label>
                <select
                  value={reqForm.requested_day}
                  onChange={(e) => setReqForm((f) => ({ ...f, requested_day: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={reqForm.requested_start_time}
                    onChange={(e) => setReqForm((f) => ({ ...f, requested_start_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={reqForm.requested_end_time}
                    onChange={(e) => setReqForm((f) => ({ ...f, requested_end_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-200 mb-1">Preferred Venue</label>
                <select
                  value={reqForm.requested_venue}
                  onChange={(e) => setReqForm((f) => ({ ...f, requested_venue: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                >
                  <option value="">Keep current / Any available</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} — {v.name} (Cap {v.capacity})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-200 mb-1">Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={reqForm.reason}
                  onChange={(e) => setReqForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Explain why this lecture needs to be rescheduled..."
                  className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReqModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-blue-700 text-sm font-bold flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

