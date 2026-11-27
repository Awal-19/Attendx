import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  QrCode,
  History,
  BarChart3,
  Bell,
  UserCheck,
  Users,
  Building2,
  GraduationCap,
  Settings,
  LogOut,
  Menu,
  X,
  Radio,
  FileSpreadsheet,
  User,
  ChevronRight,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api, { getNotificationWebSocketUrl } from '../../services/api';

const NAV_ITEMS = {
  STUDENT: [
    { label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
    { label: 'My Courses', path: '/student/courses', icon: BookOpen },
    { label: 'My Timetable', path: '/student/timetable', icon: Calendar },
    { label: 'Scan Attendance QR', path: '/student/scan', icon: QrCode, highlight: true },
    { label: 'Register My Face', path: '/student/face-enrollment', icon: UserCheck },
    { label: 'Attendance History', path: '/student/history', icon: History },
    { label: 'Attendance Analytics', path: '/student/analytics', icon: BarChart3 },
    { label: 'Notifications', path: '/student/notifications', icon: Bell, badge: true },
    { label: 'Profile Settings', path: '/student/profile', icon: User },
  ],
  LECTURER: [
    { label: 'Dashboard', path: '/lecturer/dashboard', icon: LayoutDashboard },
    { label: 'My Courses', path: '/lecturer/courses', icon: BookOpen },
    { label: 'Teaching Schedule', path: '/lecturer/timetable', icon: Calendar },
    { label: 'Start & Live QR Session', path: '/lecturer/live-session', icon: Radio, highlight: true },
    { label: 'Attendance History', path: '/lecturer/history', icon: History },
    { label: 'Reports & Exports', path: '/lecturer/reports', icon: FileSpreadsheet },
    { label: 'Notifications', path: '/lecturer/notifications', icon: Bell, badge: true },
    { label: 'Profile Settings', path: '/lecturer/profile', icon: User },
  ],
  ADMIN: [
    { label: 'Admin Overview', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Manage Students', path: '/admin/students', icon: GraduationCap },
    { label: 'Manage Lecturers', path: '/admin/lecturers', icon: UserCheck },
    { label: 'Manage Courses', path: '/admin/courses', icon: BookOpen },
    { label: 'Timetable & Venues', path: '/admin/timetable', icon: Calendar },
    { label: 'Manage Departments', path: '/admin/departments', icon: Building2 },
    { label: 'Manage Programmes', path: '/admin/programmes', icon: Users },
    { label: 'University Analytics', path: '/admin/analytics', icon: BarChart3 },
    { label: 'Biometric Governance', path: '/admin/biometrics', icon: UserCheck },
    { label: 'Security & Backups', path: '/admin/security', icon: ShieldCheck },
    { label: 'Announcements', path: '/admin/announcements', icon: Radio },
    { label: 'Notifications', path: '/admin/notifications', icon: Bell, badge: true },
    { label: 'System Settings', path: '/admin/settings', icon: Settings },
  ],
};

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
    setBellOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;
    let ws = null;
    let reconnectTimer = null;

    const fetchNotifications = async () => {
      try {
        const res = await api.get('/notifications/?limit=8');
        if (mounted) {
          setUnreadCount(res.data.unread_count || 0);
          setRecentNotifications(res.data.notifications || []);
        }
      } catch {
        // ignore
      }
    };

    const connectWs = () => {
      if (!mounted) return;
      try {
        ws = new WebSocket(getNotificationWebSocketUrl());
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'new_notification' && data.notification) {
              setUnreadCount(data.unread_count ?? 1);
              setRecentNotifications((prev) => [data.notification, ...prev].slice(0, 8));
              addToast(data.notification.title, 'info', 'New Notification');
            }
          } catch {
            // ignore
          }
        };
        ws.onclose = () => {
          if (mounted) {
            reconnectTimer = setTimeout(connectWs, 5000);
          }
        };
      } catch {
        // fallback polling handles updates
      }
    };

    fetchNotifications();
    connectWs();
    const interval = setInterval(fetchNotifications, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [location.pathname, addToast]);

  const handleLogout = async () => {
    const redirectPath = await logout();
    addToast('You have been securely logged out of AttendX.', 'info');
    navigate(redirectPath || '/login');
  };

  const role = user?.role || 'STUDENT';
  const menuItems = NAV_ITEMS[role] || NAV_ITEMS.STUDENT;

  const identitySubtext =
    role === 'STUDENT'
      ? user?.student_profile?.index_number || user?.email
      : role === 'LECTURER'
      ? user?.lecturer_profile?.staff_id || user?.email
      : 'UCC System Administrator';

  return (
    <div className="min-h-screen flex bg-[#f4f7fb] text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* Embedded Liquid Glass Sidebar & Dashboard Theme Styles */}
      <style>{`
        .ucc-sidebar-shell {
          background: linear-gradient(180deg, #040d21 0%, #071738 48%, #05112a 100%);
          border-right: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 12px 0 36px -10px rgba(2, 6, 23, 0.55);
        }
        .ucc-sidebar-glass-profile {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.11) 0%,
            rgba(29, 78, 216, 0.22) 55%,
            rgba(220, 38, 38, 0.14) 100%
          );
          backdrop-filter: blur(20px) saturate(165%);
          -webkit-backdrop-filter: blur(20px) saturate(165%);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow:
            0 16px 32px -12px rgba(2, 6, 23, 0.6),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.3);
        }
        .ucc-nav-item-active {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 64%, #b91c1c 94%, #dc2626 100%);
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow:
            0 10px 24px -6px rgba(37, 99, 235, 0.55),
            0 4px 14px -4px rgba(220, 38, 38, 0.35),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.35);
          color: #ffffff;
        }
        .ucc-nav-item-inactive {
          background: transparent;
          border: 1px solid transparent;
          color: rgba(255, 255, 255, 0.82);
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ucc-nav-item-inactive:hover {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.09) 0%,
            rgba(37, 99, 235, 0.18) 65%,
            rgba(220, 38, 38, 0.12) 100%
          );
          border-color: rgba(255, 255, 255, 0.16);
          color: #ffffff;
          transform: translateX(2px);
        }
        .ucc-nav-item-highlight {
          background: linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.16) 0%,
            rgba(220, 38, 38, 0.14) 100%
          );
          border: 1px solid rgba(147, 197, 253, 0.24);
          color: #ffffff;
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ucc-nav-item-highlight:hover {
          background: linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.28) 0%,
            rgba(220, 38, 38, 0.24) 100%
          );
          border-color: rgba(255, 255, 255, 0.3);
          transform: translateX(2px);
        }
      `}</style>

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#040d21]/70 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`ucc-sidebar-shell fixed inset-y-0 left-0 z-50 w-72 text-white flex flex-col overflow-hidden transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Subtle Ambient Blue & Red Lighting Inside Sidebar */}
        <div
          className="absolute -top-24 -left-24 w-64 h-64 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.28) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute -bottom-24 -right-20 w-64 h-64 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(220, 38, 38, 0.2) 0%, transparent 70%)',
            filter: 'blur(45px)',
          }}
        />

        {/* Brand Header */}
        <div className="relative z-10 h-16 px-5 flex items-center justify-between border-b border-white/12">
          <Link to="/" className="flex items-center gap-3 group">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md transition-transform group-hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.5)',
              }}
            >
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">AttendX</span>
                <span
                  className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded text-white"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(37, 99, 235, 0.45) 0%, rgba(220, 38, 38, 0.45) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.24)',
                  }}
                >
                  UCC
                </span>
              </div>
              <p className="text-[11px] text-blue-200/75 leading-none mt-0.5">
                Smart Attendance OS
              </p>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-blue-200/70 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Liquid Glass Profile Card */}
        <div className="ucc-sidebar-glass-profile relative z-10 p-4 mx-3.5 mt-4 rounded-2xl overflow-hidden">
          {/* Top Specular Highlight Line */}
          <div
            className="absolute top-0 inset-x-0 h-[1.5px]"
            style={{
              background:
                'linear-gradient(90deg, transparent 8%, rgba(96, 165, 250, 0.8) 30%, rgba(255, 255, 255, 0.9) 50%, rgba(248, 113, 113, 0.8) 70%, transparent 92%)',
            }}
          />
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-md"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #dc2626 100%)',
                border: '1.5px solid rgba(255, 255, 255, 0.45)',
              }}
            >
              {user?.full_name
                ?.split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">{user?.full_name}</p>
              <p className="text-xs font-mono text-blue-100/80 truncate">{identitySubtext}</p>
            </div>
          </div>

          <div className="mt-3.5 pt-2.5 border-t border-white/12 flex items-center justify-between">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full text-white"
              style={{
                background:
                  'linear-gradient(90deg, rgba(29, 78, 216, 0.55) 0%, rgba(220, 38, 38, 0.42) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
              }}
            >
              {role} PORTAL
            </span>
            <span className="text-[11px] text-white/95 flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-400 ring-2 ring-blue-400/50 animate-pulse" />
              Verified
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="relative z-10 flex-1 px-3.5 py-4 space-y-1.5 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200/60">
            Navigation
          </p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold ${
                    isActive
                      ? 'ucc-nav-item-active'
                      : item.highlight
                      ? 'ucc-nav-item-highlight'
                      : 'ucc-nav-item-inactive'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-white'
                            : item.highlight
                            ? 'text-red-400 group-hover:text-white'
                            : 'text-blue-300/85 group-hover:text-white'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && unreadCount > 0 ? (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-600 text-white border border-white/30">
                        {unreadCount}
                      </span>
                    ) : (
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition ${
                          isActive ? 'opacity-90 text-white' : 'opacity-0 group-hover:opacity-75'
                        }`}
                      />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom-Left Authentic Official UCC Institutional Crest & Sign-Out Button */}
        <div className="relative z-10 px-4 pt-3 pb-4 border-t border-white/12 space-y-3">
          {/* Official UCC Crest prominently positioned at the bottom-left corner without the old info box */}
          <div className="flex items-center pl-1">
            <img
              src="/images/ucc-official-crest.png"
              alt="Official University of Cape Coast Institutional Crest"
              className="w-14 h-16 object-contain drop-shadow-[0_6px_16px_rgba(255,255,255,0.18)] transition-transform duration-300 hover:scale-105"
            />
          </div>

          {/* Redesigned Sign Out Button */}
          <button
            onClick={handleLogout}
            className="group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-white border border-white/12 hover:bg-red-600/20 hover:border-red-400/40 transition-all duration-200 cursor-pointer"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <LogOut className="w-4 h-4 text-red-400 group-hover:text-red-300 transition-transform group-hover:-translate-x-0.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header
          className="h-16 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 border-b border-slate-200/80"
          style={{
            background: 'rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="lg:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/images/ucc-official-crest.png"
                alt="UCC Crest"
                className="w-6 h-7 sm:w-7 sm:h-8 object-contain shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-extrabold text-[#061430] truncate">
                  <span className="sm:hidden">AttendX</span>
                  <span className="hidden sm:inline">University of Cape Coast (UCC)</span>
                </h1>
                <p className="text-xs text-slate-500 hidden sm:block">
                  AttendX Cryptographic QR Classroom Verification Platform
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {role === 'STUDENT' && (
              <Link
                to="/student/scan"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-bold shadow-md transition hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
                }}
              >
                <QrCode className="w-4 h-4" />
                <span>Scan QR</span>
              </Link>
            )}
            {role === 'LECTURER' && (
              <Link
                to="/lecturer/live-session"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-bold shadow-md transition hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
                  boxShadow:
                    '0 8px 20px -6px rgba(37, 99, 235, 0.55), 0 4px 12px -4px rgba(220, 38, 38, 0.35)',
                }}
              >
                <Radio className="w-4 h-4 text-red-200 animate-pulse" />
                <span>Projector QR</span>
              </Link>
            )}

            <div className="relative">
              <button
                onClick={() => setBellOpen((prev) => !prev)}
                className="relative p-2.5 rounded-xl text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 transition cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="fixed sm:absolute right-4 sm:right-0 left-4 sm:left-auto top-16 sm:top-auto sm:mt-2 w-auto sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-[#061430] text-white">
                    <span className="text-xs font-extrabold uppercase tracking-wider">
                      Notifications ({unreadCount} unread)
                    </span>
                    <button
                      onClick={async () => {
                        await api.post('/notifications/');
                        setUnreadCount(0);
                        setRecentNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                      }}
                      className="text-[11px] font-bold text-blue-200 hover:text-white cursor-pointer"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {recentNotifications.length === 0 ? (
                      <p className="p-6 text-center text-xs text-slate-500">No notifications yet.</p>
                    ) : (
                      recentNotifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={async () => {
                            if (!n.is_read) {
                              await api.patch(`/notifications/${n.id}/read/`);
                              setUnreadCount((c) => Math.max(0, c - 1));
                              setRecentNotifications((prev) =>
                                prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
                              );
                            }
                          }}
                          className={`p-3.5 text-xs cursor-pointer transition ${
                            n.is_read ? 'bg-white text-slate-600' : 'bg-blue-50/70 text-[#061430]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold truncate">{n.title}</span>
                            {!n.is_read && <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <Link
                    to={`/${role.toLowerCase()}/notifications`}
                    onClick={() => setBellOpen(false)}
                    className="block py-2.5 text-center text-xs font-bold text-blue-700 hover:bg-blue-50 border-t border-slate-100"
                  >
                    Open Notification Centre →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 px-4 py-5 sm:p-8 pb-24 md:pb-8 max-w-7xl w-full mx-auto min-w-0">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar (< 768px) for Student Portal */}
        {role === 'STUDENT' && (
          <nav
            aria-label="Mobile Navigation"
            className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="grid grid-cols-5 h-16">
              {[
                { label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
                { label: 'Scan', path: '/student/scan', icon: QrCode },
                { label: 'Courses', path: '/student/courses', icon: BookOpen },
                { label: 'History', path: '/student/history', icon: ClipboardList },
                { label: 'Profile', path: '/student/profile', icon: User },
              ].map((navItem) => {
                const Icon = navItem.icon;
                return (
                  <NavLink
                    key={navItem.path}
                    to={navItem.path}
                    className={({ isActive }) =>
                      `min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition ${
                        isActive ? 'text-blue-700' : 'text-slate-500 hover:text-[#061430]'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span>{navItem.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
};

export default DashboardLayout;
