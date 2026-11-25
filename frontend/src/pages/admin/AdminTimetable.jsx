import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Search,
  Edit3,
  Trash2,
  XCircle,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Building2,
  ClipboardList,
  Users,
  X,
} from 'lucide-react';
import api from '../../services/api';

const DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

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

const REQ_STATUS_BADGE = {
  PENDING: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
  APPROVED: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
  REJECTED: 'bg-red-500/20 text-red-200 border-red-400/30',
};

const fmtTime = (t) => (t ? String(t).slice(0, 5) : '--:--');

const emptyScheduleForm = {
  course: '',
  lecturer: '',
  venue_obj: '',
  semester: '',
  day_of_week: 'MONDAY',
  lecture_date: '',
  start_time: '08:30',
  end_time: '10:30',
  notes: '',
};

const emptyVenueForm = {
  name: '',
  code: '',
  capacity: 100,
  location: '',
  is_active: true,
};

export default function AdminTimetable() {
  const [activeTab, setActiveTab] = useState('timetable');
  const [viewMode, setViewMode] = useState('weekly');
  const [selectedDay, setSelectedDay] = useState('MONDAY');

  const [schedules, setSchedules] = useState([]);
  const [venues, setVenues] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [courses, setCourses] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [semesters, setSemesters] = useState([]);

  const [filters, setFilters] = useState({
    department: '',
    programme: '',
    lecturer: '',
    semester: '',
    status: '',
    search: '',
  });

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);

  // Schedule modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);
  const [formError, setFormError] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [slotVenues, setSlotVenues] = useState([]);

  // Venue modal state
  const [venueModalOpen, setVenueModalOpen] = useState(false);
  const [editingVenueId, setEditingVenueId] = useState(null);
  const [venueForm, setVenueForm] = useState(emptyVenueForm);
  const [venueCheckSlot, setVenueCheckSlot] = useState({
    day_of_week: 'MONDAY',
    start_time: '08:30',
    end_time: '10:30',
  });

  // Change request decision notes
  const [decisionNotes, setDecisionNotes] = useState({});

  const showBanner = (type, message) => {
    setBanner({ type, message });
    setTimeout(() => setBanner(null), 6000);
  };

  const fetchReferenceData = useCallback(async () => {
    try {
      const [cRes, lRes, dRes, pRes, sRes] = await Promise.all([
        api.get('/academics/courses/'),
        api.get('/auth/admin/lecturers/'),
        api.get('/academics/departments/'),
        api.get('/academics/programmes/'),
        api.get('/academics/semesters/'),
      ]);
      setCourses(cRes.data?.results || cRes.data || []);
      setLecturers(lRes.data?.results || lRes.data || []);
      setDepartments(dRes.data?.results || dRes.data || []);
      setProgrammes(pRes.data?.results || pRes.data || []);
      setSemesters(sRes.data?.results || sRes.data || []);
    } catch {
      // Ignore secondary reference errors
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      const res = await api.get('/academics/schedules/', { params });
      setSchedules(res.data || []);
    } catch {
      showBanner('error', 'Failed to load lecture schedules.');
    }
  }, [filters]);

  const fetchVenues = useCallback(async (slotParams = null) => {
    try {
      const params = slotParams || venueCheckSlot;
      const res = await api.get('/academics/venues/', { params });
      if (slotParams) {
        setSlotVenues(res.data || []);
      } else {
        setVenues(res.data || []);
      }
    } catch {
      // Ignore
    }
  }, [venueCheckSlot]);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get('/academics/schedule-requests/');
      setChangeRequests(res.data || []);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchReferenceData(),
        fetchSchedules(),
        fetchVenues(),
        fetchRequests(),
      ]);
      setLoading(false);
    };
    loadAll();
  }, [fetchReferenceData, fetchSchedules, fetchVenues, fetchRequests]);

  useEffect(() => {
    if (scheduleModalOpen && scheduleForm.day_of_week && scheduleForm.start_time && scheduleForm.end_time) {
      fetchVenues({
        day_of_week: scheduleForm.day_of_week,
        start_time: scheduleForm.start_time,
        end_time: scheduleForm.end_time,
        exclude_schedule_id: editingScheduleId || '',
      });
    }
  }, [
    scheduleModalOpen,
    scheduleForm.day_of_week,
    scheduleForm.start_time,
    scheduleForm.end_time,
    editingScheduleId,
    fetchVenues,
  ]);

  const openCreateSchedule = () => {
    setEditingScheduleId(null);
    const activeSem = semesters.find((s) => s.is_current) || semesters[0];
    setScheduleForm({
      ...emptyScheduleForm,
      semester: activeSem ? activeSem.id : '',
    });
    setFormError('');
    setScheduleModalOpen(true);
  };

  const openEditSchedule = (s) => {
    setEditingScheduleId(s.id);
    setScheduleForm({
      course: s.course || '',
      lecturer: s.lecturer || '',
      venue_obj: s.venue_obj || '',
      semester: s.semester || '',
      day_of_week: s.day_of_week || 'MONDAY',
      lecture_date: s.lecture_date || '',
      start_time: fmtTime(s.start_time),
      end_time: fmtTime(s.end_time),
      notes: s.notes || '',
    });
    setFormError('');
    setScheduleModalOpen(true);
  };

  const handleCourseSelect = (courseId) => {
    const found = courses.find((c) => String(c.id) === String(courseId));
    setScheduleForm((prev) => ({
      ...prev,
      course: courseId,
      lecturer: found?.lecturer || prev.lecturer,
      semester: found?.semester || prev.semester,
    }));
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setFormError('');
    setSavingSchedule(true);
    try {
      const payload = {
        ...scheduleForm,
        lecture_date: scheduleForm.lecture_date || null,
        venue_obj: scheduleForm.venue_obj || null,
        semester: scheduleForm.semester || null,
      };
      let res;
      if (editingScheduleId) {
        res = await api.patch(`/academics/schedules/${editingScheduleId}/`, payload);
      } else {
        res = await api.post('/academics/schedules/', payload);
      }
      setScheduleModalOpen(false);
      await fetchSchedules();
      if (res.data?.capacity_warning) {
        showBanner('warning', `${res.data.message} — ${res.data.capacity_warning}`);
      } else {
        showBanner('success', res.data?.message || 'Schedule saved.');
      }
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msg =
          data.conflict ||
          data.end_time ||
          data.lecture_date ||
          data.non_field_errors ||
          data.detail ||
          JSON.stringify(data);
        setFormError(Array.isArray(msg) ? msg[0] : String(msg));
      } else {
        setFormError('Unable to save schedule. Please verify all fields.');
      }
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleToggleCancel = async (s) => {
    const nextStatus = s.status === 'CANCELLED' ? 'SCHEDULED' : 'CANCELLED';
    try {
      const res = await api.patch(`/academics/schedules/${s.id}/`, { status: nextStatus });
      showBanner('success', res.data?.message || `Schedule marked ${nextStatus}.`);
      fetchSchedules();
    } catch (err) {
      showBanner('error', err.response?.data?.conflict || 'Could not update schedule status.');
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('Delete this lecture schedule permanently?')) return;
    try {
      await api.delete(`/academics/schedules/${id}/`);
      showBanner('success', 'Lecture schedule deleted.');
      fetchSchedules();
    } catch {
      showBanner('error', 'Failed to delete schedule.');
    }
  };

  const handleSaveVenue = async (e) => {
    e.preventDefault();
    try {
      if (editingVenueId) {
        await api.patch(`/academics/venues/${editingVenueId}/`, venueForm);
        showBanner('success', 'Venue updated.');
      } else {
        await api.post('/academics/venues/', venueForm);
        showBanner('success', 'Venue created.');
      }
      setVenueModalOpen(false);
      fetchVenues();
    } catch (err) {
      showBanner('error', err.response?.data?.code?.[0] || 'Failed to save venue.');
    }
  };

  const handleDeleteVenue = async (id) => {
    if (!window.confirm('Delete this venue?')) return;
    try {
      await api.delete(`/academics/venues/${id}/`);
      showBanner('success', 'Venue deleted.');
      fetchVenues();
    } catch {
      showBanner('error', 'Cannot delete venue while schedules reference it.');
    }
  };

  const handleRequestDecision = async (reqId, status) => {
    try {
      const res = await api.patch(`/academics/schedule-requests/${reqId}/`, {
        status,
        admin_notes: decisionNotes[reqId] || '',
      });
      showBanner('success', res.data?.message || `Request ${status.toLowerCase()}.`);
      await Promise.all([fetchRequests(), fetchSchedules()]);
    } catch (err) {
      const msg = err.response?.data?.conflict || err.response?.data?.error || 'Failed to process request.';
      showBanner('error', msg);
    }
  };

  const pendingCount = changeRequests.filter((r) => r.status === 'PENDING').length;

  // Monthly calendar helper (current month days mapped by weekday)
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
            <span>Phase 6 • Smart Timetable Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-white">University Timetable & Venue Scheduling</h1>
          <p className="text-sm text-blue-100/70 mt-1">
            Manage course lecture schedules, resolve lecturer/venue/student conflicts, and approve schedule requests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setEditingVenueId(null);
              setVenueForm(emptyVenueForm);
              setVenueModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-sm font-semibold flex items-center gap-2 transition"
          >
            <Building2 className="w-4 h-4 text-blue-300" />
            Add Venue
          </button>
          <button
            onClick={openCreateSchedule}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-blue-700 hover:from-red-500 hover:to-blue-600 text-sm font-semibold flex items-center gap-2 shadow-lg shadow-red-900/30 transition"
          >
            <Plus className="w-4 h-4" />
            Schedule Lecture
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {banner && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border backdrop-blur-md text-sm ${
            banner.type === 'error'
              ? 'bg-red-950/70 border-red-500/40 text-red-100'
              : banner.type === 'warning'
              ? 'bg-amber-950/70 border-amber-500/40 text-amber-100'
              : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-100'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'error' || banner.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex bg-[#061430]/80 border border-white/15 rounded-xl p-1">
          {[
            { id: 'timetable', label: 'Master Timetable', icon: Calendar },
            { id: 'venues', label: `Venues (${venues.length})`, icon: Building2 },
            {
              id: 'requests',
              label: `Change Requests${pendingCount ? ` (${pendingCount})` : ''}`,
              icon: ClipboardList,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
                  active
                    ? 'bg-blue-700 text-white shadow-md'
                    : 'text-blue-100/70 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'timetable' && (
          <div className="inline-flex bg-[#061430]/80 border border-white/15 rounded-xl p-1">
            {['weekly', 'daily', 'monthly', 'list'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                  viewMode === mode
                    ? 'bg-red-600 text-white'
                    : 'text-blue-100/70 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TAB 1: TIMETABLE */}
      {activeTab === 'timetable' && (
        <div className="space-y-5">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-[#061430]/75 border border-white/15 rounded-2xl p-4">
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-blue-300/60 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search course, lecturer, venue..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-blue-200/40 focus:outline-none focus:border-blue-400"
              />
            </div>

            <select
              value={filters.department}
              onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
              ))}
            </select>

            <select
              value={filters.programme}
              onChange={(e) => setFilters((f) => ({ ...f, programme: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
            >
              <option value="">All Programmes</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>{p.code}</option>
              ))}
            </select>

            <select
              value={filters.lecturer}
              onChange={(e) => setFilters((f) => ({ ...f, lecturer: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
            >
              <option value="">All Lecturers</option>
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>{l.full_name}</option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
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
              Loading timetable...
            </div>
          ) : viewMode === 'weekly' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
              {DAYS.map((day) => {
                const dayItems = schedules.filter((s) => s.day_of_week === day);
                return (
                  <div
                    key={day}
                    className="bg-[#061430]/75 border border-white/15 rounded-2xl p-3 flex flex-col min-h-[260px]"
                  >
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
                      <span className="text-xs font-bold tracking-wider uppercase text-blue-200">
                        {DAY_LABELS[day]}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-blue-100">
                        {dayItems.length}
                      </span>
                    </div>
                    <div className="space-y-2.5 flex-1">
                      {dayItems.length === 0 ? (
                        <p className="text-xs text-blue-200/40 italic text-center mt-8">No classes</p>
                      ) : (
                        dayItems.map((s) => (
                          <div
                            key={s.id}
                            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 space-y-1.5 transition"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-red-300">{s.course_code}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                  STATUS_BADGE[s.status] || STATUS_BADGE.SCHEDULED
                                }`}
                              >
                                {s.status}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-white line-clamp-2">{s.course_title}</p>
                            <div className="text-[11px] text-blue-200/80 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-blue-300" />
                              {fmtTime(s.start_time)} - {fmtTime(s.end_time)}
                            </div>
                            <div className="text-[11px] text-blue-200/80 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-red-300" />
                              {s.venue_display}
                            </div>
                            <p className="text-[11px] text-blue-200/60 truncate">{s.lecturer_name}</p>
                            <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-white/10">
                              <button
                                onClick={() => openEditSchedule(s)}
                                title="Edit / Reschedule"
                                className="p-1 rounded hover:bg-blue-500/20 text-blue-300"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleCancel(s)}
                                title={s.status === 'CANCELLED' ? 'Restore' : 'Cancel'}
                                className="p-1 rounded hover:bg-amber-500/20 text-amber-300"
                              >
                                {s.status === 'CANCELLED' ? (
                                  <RotateCcw className="w-3.5 h-3.5" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteSchedule(s.id)}
                                title="Delete"
                                className="p-1 rounded hover:bg-red-500/20 text-red-300"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
                        ? 'bg-blue-700 text-white border border-blue-400/50'
                        : 'bg-[#061430]/75 text-blue-100/70 border border-white/10 hover:text-white'
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
                    <div
                      key={s.id}
                      className="bg-[#061430]/80 border border-white/15 rounded-2xl p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-red-400">{s.course_code}</span>
                          <h3 className="text-base font-bold text-white">{s.course_title}</h3>
                        </div>
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full border ${
                            STATUS_BADGE[s.status] || STATUS_BADGE.SCHEDULED
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-sm text-blue-100/80">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-400" />
                          <span>{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-red-400" />
                          <span>{s.venue_display} {s.venue_capacity ? `(Cap: ${s.venue_capacity})` : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-300" />
                          <span>{s.lecturer_name} • {s.enrolled_count} enrolled</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                        <button
                          onClick={() => openEditSchedule(s)}
                          className="flex-1 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 text-xs font-semibold"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleToggleCancel(s)}
                          className="flex-1 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-200 text-xs font-semibold"
                        >
                          {s.status === 'CANCELLED' ? 'Restore' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : viewMode === 'monthly' ? (
            <div className="bg-[#061430]/80 border border-white/15 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{monthName}</h3>
                <span className="text-xs text-blue-200/70">Recurring weekly + dated lectures mapped across the month</span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((dayNum) => {
                  const dateObj = new Date(year, month, dayNum);
                  const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const dayEnum = jsDayToEnum[dateObj.getDay()];
                  const daySchedules = schedules.filter(
                    (s) => s.lecture_date === isoDate || (!s.lecture_date && s.day_of_week === dayEnum)
                  );
                  return (
                    <div
                      key={dayNum}
                      className="min-h-[96px] p-2 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-1"
                    >
                      <span className="text-xs font-bold text-blue-200">{dayNum}</span>
                      {daySchedules.slice(0, 3).map((s) => (
                        <div
                          key={s.id}
                          onClick={() => openEditSchedule(s)}
                          className="cursor-pointer text-[10px] px-1.5 py-0.5 rounded bg-blue-700/60 hover:bg-blue-600 text-white truncate"
                          title={`${s.course_code} (${fmtTime(s.start_time)})`}
                        >
                          {s.course_code} {fmtTime(s.start_time)}
                        </div>
                      ))}
                      {daySchedules.length > 3 && (
                        <span className="text-[10px] text-red-300">+{daySchedules.length - 3} more</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-[#061430]/80 border border-white/15 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-blue-200 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3">Course</th>
                      <th className="px-4 py-3">Day & Time</th>
                      <th className="px-4 py-3">Venue</th>
                      <th className="px-4 py-3">Lecturer</th>
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
                          <div className="font-medium">{s.day_of_week}</div>
                          <div className="text-xs text-blue-200/70">
                            {fmtTime(s.start_time)} - {fmtTime(s.end_time)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-blue-100">{s.venue_display}</td>
                        <td className="px-4 py-3 text-blue-100">{s.lecturer_name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full border ${STATUS_BADGE[s.status]}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => openEditSchedule(s)}
                            className="text-blue-300 hover:text-white text-xs font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleCancel(s)}
                            className="text-amber-300 hover:text-white text-xs font-semibold"
                          >
                            {s.status === 'CANCELLED' ? 'Restore' : 'Cancel'}
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(s.id)}
                            className="text-red-300 hover:text-white text-xs font-semibold"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {schedules.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-blue-200/60">
                          No lecture schedules match your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: VENUES */}
      {activeTab === 'venues' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 bg-[#061430]/75 border border-white/15 rounded-2xl p-4">
            <span className="text-xs font-bold uppercase text-blue-200">Check Availability For Slot:</span>
            <select
              value={venueCheckSlot.day_of_week}
              onChange={(e) => setVenueCheckSlot((v) => ({ ...v, day_of_week: e.target.value }))}
              className="px-3 py-1.5 rounded-xl bg-[#0b1f48] border border-white/15 text-sm"
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <input
              type="time"
              value={venueCheckSlot.start_time}
              onChange={(e) => setVenueCheckSlot((v) => ({ ...v, start_time: e.target.value }))}
              className="px-3 py-1.5 rounded-xl bg-[#0b1f48] border border-white/15 text-sm"
            />
            <input
              type="time"
              value={venueCheckSlot.end_time}
              onChange={(e) => setVenueCheckSlot((v) => ({ ...v, end_time: e.target.value }))}
              className="px-3 py-1.5 rounded-xl bg-[#0b1f48] border border-white/15 text-sm"
            />
            <button
              onClick={() => fetchVenues()}
              className="px-4 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-xs font-bold"
            >
              Check Slot
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {venues.map((v) => (
              <div
                key={v.id}
                className="bg-[#061430]/80 border border-white/15 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-400/30">
                      {v.code}
                    </span>
                    <h3 className="text-base font-bold text-white mt-2">{v.name}</h3>
                    <p className="text-xs text-blue-200/70">{v.location || 'Main Campus'}</p>
                  </div>
                  {v.is_available !== undefined && (
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        v.is_available
                          ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                          : 'bg-red-500/20 text-red-200 border-red-400/30'
                      }`}
                    >
                      {v.is_available ? 'Available' : 'Occupied'}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-blue-100/80 pt-2 border-t border-white/10">
                  <span>Capacity: <strong>{v.capacity}</strong> seats</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingVenueId(v.id);
                        setVenueForm({
                          name: v.name,
                          code: v.code,
                          capacity: v.capacity,
                          location: v.location || '',
                          is_active: v.is_active,
                        });
                        setVenueModalOpen(true);
                      }}
                      className="text-blue-300 hover:text-white font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteVenue(v.id)}
                      className="text-red-300 hover:text-white font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CHANGE REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {changeRequests.length === 0 ? (
            <div className="p-10 text-center bg-[#061430]/75 border border-white/15 rounded-2xl text-blue-200/60">
              No lecturer schedule change requests yet.
            </div>
          ) : (
            changeRequests.map((r) => (
              <div
                key={r.id}
                className="bg-[#061430]/80 border border-white/15 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-300">{r.course_code}</span>
                    <span className="text-sm font-bold text-white">{r.course_title}</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        REQ_STATUS_BADGE[r.status] || REQ_STATUS_BADGE.PENDING
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-blue-200/80">
                    Lecturer: <strong>{r.lecturer_name}</strong> • Requested:{' '}
                    <strong>
                      {r.requested_day} {fmtTime(r.requested_start_time)} - {fmtTime(r.requested_end_time)}
                    </strong>
                    {r.requested_venue_name ? ` @ ${r.requested_venue_name}` : ''}
                  </p>
                  <p className="text-sm text-blue-100/90">Reason: {r.reason}</p>
                </div>

                {r.status === 'PENDING' && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      placeholder="Optional admin notes..."
                      value={decisionNotes[r.id] || ''}
                      onChange={(e) =>
                        setDecisionNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                      className="px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white"
                    />
                    <button
                      onClick={() => handleRequestDecision(r.id, 'APPROVED')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRequestDecision(r.id, 'REJECTED')}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* SCHEDULE MODAL */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#07193d] border border-white/20 rounded-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editingScheduleId ? 'Edit / Reschedule Lecture' : 'Schedule New Lecture'}
              </h2>
              <button onClick={() => setScheduleModalOpen(false)} className="text-blue-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-100 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">Course *</label>
                  <select
                    required
                    value={scheduleForm.course}
                    onChange={(e) => handleCourseSelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                  >
                    <option value="">Select course...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">Lecturer</label>
                  <select
                    value={scheduleForm.lecturer}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, lecturer: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                  >
                    <option value="">Default Course Lecturer</option>
                    {lecturers.map((l) => (
                      <option key={l.id} value={l.id}>{l.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">Day of Week *</label>
                  <select
                    required
                    value={scheduleForm.day_of_week}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, day_of_week: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">
                    Specific Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.lecture_date}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, lecture_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">Start Time *</label>
                  <input
                    type="time"
                    required
                    value={scheduleForm.start_time}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">End Time *</label>
                  <input
                    type="time"
                    required
                    value={scheduleForm.end_time}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, end_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">
                    Venue (Slot Availability Checked)
                  </label>
                  <select
                    value={scheduleForm.venue_obj}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, venue_obj: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                  >
                    <option value="">Select venue...</option>
                    {(slotVenues.length ? slotVenues : venues).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} — {v.name} (Cap {v.capacity}) {v.is_available === false ? '[Occupied]' : '[Available]'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">Semester</label>
                  <select
                    value={scheduleForm.semester}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, semester: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                  >
                    <option value="">Auto / None</option>
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-blue-200 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional instructions or room notes..."
                  className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSchedule}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-blue-700 hover:from-red-500 hover:to-blue-600 text-sm font-bold disabled:opacity-50"
                >
                  {savingSchedule ? 'Checking Conflicts...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VENUE MODAL */}
      {venueModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#07193d] border border-white/20 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editingVenueId ? 'Edit Venue' : 'Add Lecture Venue'}
              </h2>
              <button onClick={() => setVenueModalOpen(false)} className="text-blue-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveVenue} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-blue-200 mb-1">Venue Code *</label>
                <input
                  required
                  value={venueForm.code}
                  onChange={(e) => setVenueForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. NLT-1"
                  className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-200 mb-1">Venue Name *</label>
                <input
                  required
                  value={venueForm.name}
                  onChange={(e) => setVenueForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. New Lecture Theatre 1"
                  className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">Capacity *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={venueForm.capacity}
                    onChange={(e) => setVenueForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1">Location</label>
                  <input
                    value={venueForm.location}
                    onChange={(e) => setVenueForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="Science Complex"
                    className="w-full px-3 py-2 rounded-xl bg-[#0b1f48] border border-white/15 text-sm text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVenueModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-sm font-bold"
                >
                  Save Venue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

