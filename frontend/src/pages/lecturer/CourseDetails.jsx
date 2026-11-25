import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Users,
  QrCode,
  UserPlus,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const CourseDetails = () => {
  const { id } = useParams();
  const { addToast } = useToast();
  const [course, setCourse] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [indexNumberToAdd, setIndexNumberToAdd] = useState('');
  const [loading, setLoading] = useState(true);

  const loadCourseDetails = async () => {
    setLoading(true);
    try {
      const [cRes, eRes] = await Promise.all([
        api.get(`/courses/${id}/`),
        api.get(`/courses/${id}/enrollments/`),
      ]);
      setCourse(cRes.data);
      setEnrollments(eRes.data);
    } catch {
      addToast('Failed to load course details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourseDetails();
  }, [id]);

  const handleEnrollStudent = async (e) => {
    e.preventDefault();
    if (!indexNumberToAdd.trim()) return;
    try {
      const res = await api.post(`/courses/${id}/enrollments/`, {
        index_number: indexNumberToAdd.trim().toUpperCase(),
      });
      addToast(res.data.message, 'success');
      setIndexNumberToAdd('');
      loadCourseDetails();
    } catch (err) {
      addToast(
        err.response?.data?.error || 'Could not find a student with that index number.',
        'error'
      );
    }
  };

  const handleRemoveStudent = async (studentId, studentName) => {
    try {
      await api.delete(`/courses/${id}/enrollments/?student_id=${studentId}`);
      addToast(`Removed ${studentName} from course roster.`, 'info');
      loadCourseDetails();
    } catch {
      addToast('Failed to remove student.', 'error');
    }
  };

  if (loading || !course) {
    return <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/lecturer/courses"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-red-600 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to My Courses</span>
          </Link>
          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1 rounded-xl text-white font-mono text-sm font-bold shadow-xs"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 65%, #dc2626 100%)',
              }}
            >
              {course.code}
            </span>
            <h2 className="text-2xl font-extrabold text-[#061430]">{course.title}</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {course.department_name} • {course.venue} • {course.schedule_day} ({course.schedule_time})
          </p>
        </div>

        <Link
          to={`/lecturer/live-session?course=${course.id}`}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white text-xs sm:text-sm font-bold shadow-md transition hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
          }}
        >
          <QrCode className="w-4 h-4" />
          <span>Start Classroom QR Session</span>
        </Link>
      </div>

      {/* Add Student by Index Number */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-[#061430] flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-700" />
            <span>Enroll Student by Index Number</span>
          </h3>
          <p className="text-xs text-slate-500">
            Add any registered UCC student directly to {course.code}
          </p>
        </div>
        <form onSubmit={handleEnrollStudent} className="flex items-center gap-2">
          <input
            type="text"
            value={indexNumberToAdd}
            onChange={(e) => setIndexNumberToAdd(e.target.value.toUpperCase())}
            placeholder="e.g. PS/CSC/24/0044"
            className="px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs sm:text-sm focus:outline-none focus:border-blue-600"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#061430] hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
          >
            Enroll Student
          </button>
        </form>
      </div>

      {/* Enrolled Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-[#061430] flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-700" />
            <span>Enrolled Students Roster ({enrollments.length})</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Index Number</th>
                <th className="py-3.5 px-5">Student Full Name</th>
                <th className="py-3.5 px-5">Programme &amp; Level</th>
                <th className="py-3.5 px-5">Sessions Attended</th>
                <th className="py-3.5 px-5">Attendance %</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
              {enrollments.map((enr) => {
                const stats = enr.attendance_stats || {};
                const pct = stats.percentage ?? 100;
                return (
                  <tr key={enr.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3.5 px-5 font-mono font-bold text-blue-700">
                      {enr.student_index_number}
                    </td>
                    <td className="py-3.5 px-5">
                      <p className="font-bold text-[#061430]">{enr.student_name}</p>
                      <p className="text-xs text-slate-500">{enr.student_email}</p>
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-600">
                      {enr.student_programme || 'UCC Student'} • Level {enr.student_level}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-xs">
                      {stats.attended} / {stats.total_sessions}
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          pct >= 75
                            ? 'bg-blue-50 text-blue-800 border border-blue-200/70'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {pct >= 75 ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        )}
                        {pct}%
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => handleRemoveStudent(enr.student, enr.student_name)}
                        className="text-red-600 hover:text-red-800 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
                        title="Remove from course"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CourseDetails;
