import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle2, PlusCircle, Trash2, MapPin, Clock, User } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const StudentCourses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('enrolled');
  const { addToast } = useToast();

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/courses/');
      setCourses(res.data);
    } catch {
      addToast('Failed to load courses.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleEnrollToggle = async (course) => {
    try {
      if (course.is_enrolled) {
        await api.delete(`/courses/${course.id}/enrollments/`);
        addToast(`Dropped ${course.code}`, 'info');
      } else {
        await api.post(`/courses/${course.id}/enrollments/`);
        addToast(`Successfully enrolled in ${course.code} - ${course.title}`, 'success');
      }
      fetchCourses();
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not update enrollment.', 'error');
    }
  };

  const enrolledList = courses.filter((c) => c.is_enrolled);
  const displayList = tab === 'enrolled' ? enrolledList : courses;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">My Registered Courses</h2>
          <p className="text-sm text-slate-500">
            View your enrolled UCC courses, lecture schedules, and attendance rates
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-200/80 p-1">
          <button
            onClick={() => setTab('enrolled')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              tab === 'enrolled'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Enrolled Courses ({enrolledList.length})
          </button>
          <button
            onClick={() => setTab('catalog')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              tab === 'catalog'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            University Catalog ({courses.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : displayList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-indigo-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No enrolled courses yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Switch to the University Catalog tab to enroll in your semester courses.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayList.map((course) => {
            const pct = course.student_attendance_rate ?? 100;
            return (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between space-y-5 hover:border-indigo-300 transition"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-mono text-xs font-bold">
                      {course.code}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {course.credit_hours} Credits • Level {course.level}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {course.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2">{course.description}</p>

                  <div className="pt-2 space-y-1.5 text-xs text-slate-600 border-t border-slate-100">
                    <p className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{course.lecturer_name}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{course.venue}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {course.schedule_day} • {course.schedule_time}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  {course.is_enrolled && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-500 font-medium">Your Attendance Rate</span>
                        <span
                          className={`font-bold ${
                            pct >= 75 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            pct >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    {course.is_enrolled ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                          <CheckCircle2 className="w-4 h-4" /> Enrolled
                        </span>
                        <button
                          onClick={() => handleEnrollToggle(course)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Drop
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleEnrollToggle(course)}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Enroll in {course.code}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentCourses;

