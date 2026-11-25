import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';

// Public Pages
import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import StudentRegisterPage from './pages/public/StudentRegisterPage';
import LecturerRegisterPage from './pages/public/LecturerRegisterPage';
import ForgotPasswordPage from './pages/public/ForgotPasswordPage';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentCourses from './pages/student/StudentCourses';
import ScanAttendance from './pages/student/ScanAttendance';
import StudentHistory from './pages/student/StudentHistory';
import StudentAnalytics from './pages/student/StudentAnalytics';
import NotificationsPage from './pages/student/NotificationsPage';
import FaceEnrollmentPage from './pages/student/FaceEnrollmentPage';
import StudentTimetable from './pages/student/StudentTimetable';

// Lecturer Pages
import LecturerDashboard from './pages/lecturer/LecturerDashboard';
import LecturerCourses from './pages/lecturer/LecturerCourses';
import CourseDetails from './pages/lecturer/CourseDetails';
import LiveAttendanceSession from './pages/lecturer/LiveAttendanceSession';
import LecturerHistory from './pages/lecturer/LecturerHistory';
import LecturerReports from './pages/lecturer/LecturerReports';
import LecturerTimetable from './pages/lecturer/LecturerTimetable';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageStudents from './pages/admin/ManageStudents';
import ManageLecturers from './pages/admin/ManageLecturers';
import ManageCourses from './pages/admin/ManageCourses';
import ManageDepartments from './pages/admin/ManageDepartments';
import ManageProgrammes from './pages/admin/ManageProgrammes';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import SystemSettings from './pages/admin/SystemSettings';
import BiometricManagement from './pages/admin/BiometricManagement';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AdminTimetable from './pages/admin/AdminTimetable';
import AdminSecurityCenter from './pages/admin/AdminSecurityCenter';

// Shared Pages
import ProfileSettings from './pages/shared/ProfileSettings';

const withLayout = (Component, allowedRoles) => (
  <ProtectedRoute allowedRoles={allowedRoles}>
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  </ProtectedRoute>
);

const App = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/student" element={<LoginPage />} />
            <Route path="/student/login" element={<LoginPage />} />
            <Route path="/login/lecturer" element={<LoginPage />} />
            <Route path="/lecturer/login" element={<LoginPage />} />
            <Route path="/register/student" element={<StudentRegisterPage />} />
            <Route path="/register/lecturer" element={<LecturerRegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Student Portal Routes */}
            <Route path="/student/dashboard" element={withLayout(StudentDashboard, ['STUDENT'])} />
            <Route path="/student/courses" element={withLayout(StudentCourses, ['STUDENT'])} />
            <Route path="/student/scan" element={withLayout(ScanAttendance, ['STUDENT'])} />
            <Route path="/student/history" element={withLayout(StudentHistory, ['STUDENT'])} />
            <Route path="/student/analytics" element={withLayout(StudentAnalytics, ['STUDENT'])} />
            <Route path="/student/face-enrollment" element={withLayout(FaceEnrollmentPage, ['STUDENT'])} />
      <Route path="/student/timetable" element={withLayout(StudentTimetable, ['STUDENT'])} />
            <Route path="/student/notifications" element={withLayout(NotificationsPage, ['STUDENT'])} />
            <Route path="/student/profile" element={withLayout(ProfileSettings, ['STUDENT'])} />

            {/* Lecturer Portal Routes */}
            <Route path="/lecturer/dashboard" element={withLayout(LecturerDashboard, ['LECTURER'])} />
            <Route path="/lecturer/courses" element={withLayout(LecturerCourses, ['LECTURER'])} />
            <Route path="/lecturer/courses/:id" element={withLayout(CourseDetails, ['LECTURER'])} />
            <Route path="/lecturer/live-session" element={withLayout(LiveAttendanceSession, ['LECTURER'])} />
            <Route path="/lecturer/history" element={withLayout(LecturerHistory, ['LECTURER'])} />
            <Route path="/lecturer/reports" element={withLayout(LecturerReports, ['LECTURER'])} />
            <Route path="/lecturer/notifications" element={withLayout(NotificationsPage, ['LECTURER'])} />
      <Route path="/lecturer/timetable" element={withLayout(LecturerTimetable, ['LECTURER'])} />
            <Route path="/lecturer/profile" element={withLayout(ProfileSettings, ['LECTURER'])} />

            {/* Administrator Portal Routes */}
            <Route path="/admin/dashboard" element={withLayout(AdminDashboard, ['ADMIN'])} />
            <Route path="/admin/students" element={withLayout(ManageStudents, ['ADMIN'])} />
            <Route path="/admin/lecturers" element={withLayout(ManageLecturers, ['ADMIN'])} />
            <Route path="/admin/courses" element={withLayout(ManageCourses, ['ADMIN'])} />
            <Route path="/admin/departments" element={withLayout(ManageDepartments, ['ADMIN'])} />
            <Route path="/admin/programmes" element={withLayout(ManageProgrammes, ['ADMIN'])} />
            <Route path="/admin/analytics" element={withLayout(AdminAnalytics, ['ADMIN'])} />
            <Route path="/admin/biometrics" element={withLayout(BiometricManagement, ['ADMIN'])} />
            <Route path="/admin/announcements" element={withLayout(AdminAnnouncements, ['ADMIN'])} />
      <Route path="/admin/timetable" element={withLayout(AdminTimetable, ['ADMIN'])} />
      <Route path="/admin/security" element={withLayout(AdminSecurityCenter, ['ADMIN'])} />
            <Route path="/admin/notifications" element={withLayout(NotificationsPage, ['ADMIN'])} />
            <Route path="/admin/settings" element={withLayout(SystemSettings, ['ADMIN'])} />

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;

