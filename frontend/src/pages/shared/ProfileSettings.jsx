import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  Save,
  LogOut,
  Mail,
  Eye,
  EyeOff,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const ProfileSettings = () => {
  const { user, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const isStudent = user?.role === 'STUDENT';
  const sp = user?.student_profile || {};

  // Non-student profile state (Lecturer/Admin)
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone_number || '');
  const [institution, setInstitution] = useState(
    user?.institution || 'University of Cape Coast (UCC)'
  );
  const [officeLocation, setOfficeLocation] = useState(
    user?.lecturer_profile?.office_location || ''
  );
  const [specialization, setSpecialization] = useState(
    user?.lecturer_profile?.specialization || ''
  );
  const [saving, setSaving] = useState(false);

  // Student SMS-verified phone edit state
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState(user?.phone_number || '');
  const [phoneOtpStep, setPhoneOtpStep] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);

  // Student "Report incorrect details" state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSending, setReportSending] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/auth/profile/', {
        full_name: fullName,
        phone_number: phone,
        institution,
        office_location: officeLocation,
        specialization,
      });
      await refreshProfile();
      addToast('Your profile settings have been updated!', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPhoneOtp = async (e) => {
    e.preventDefault();
    setPhoneSaving(true);
    try {
      const res = await api.post('/auth/profile/phone/request/', { phone_number: newPhone });
      setPhoneOtpStep(true);
      addToast(res.data?.message || '6-digit verification code sent via SMS.', 'info');
    } catch (err) {
      addToast(err.response?.data?.error || 'Invalid phone number.', 'error');
    } finally {
      setPhoneSaving(false);
    }
  };

  const handleConfirmPhoneOtp = async (e) => {
    e.preventDefault();
    setPhoneSaving(true);
    try {
      await api.post('/auth/profile/phone/confirm/', { code: phoneOtpCode });
      await refreshProfile();
      setEditingPhone(false);
      setPhoneOtpStep(false);
      setPhoneOtpCode('');
      addToast('Phone number verified and updated!', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Invalid or expired verification code.', 'error');
    } finally {
      setPhoneSaving(false);
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportText.trim()) return;
    setReportSending(true);
    try {
      const res = await api.post('/auth/profile/report-issue/', { details: reportText.trim() });
      setReportText('');
      setReportOpen(false);
      addToast(res.data?.message || 'Correction request sent to administrators.', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not submit report.', 'error');
    } finally {
      setReportSending(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addToast('New password and confirmation do not match.', 'error');
      return;
    }
    try {
      await api.post('/auth/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      addToast('Password changed! Other active sessions were signed out.', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not update password.', 'error');
    }
  };

  const handleRequestEmailChange = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/profile/email-change/', { new_email: newEmail });
      setNewEmail('');
      addToast(res.data?.message || 'Confirmation link sent to your new email.', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not request email change.', 'error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-[22px] sm:text-2xl font-extrabold text-[#061430]">
          Account &amp; Profile Settings
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          {isStudent
            ? 'Your official UCC student record and security credentials'
            : 'Manage your university identity details and security credentials'}
        </p>
      </div>

      {isStudent ? (
        <div className="relative bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-5 overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-700 via-blue-600 to-red-600" />

          <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="w-12 h-12 rounded-2xl text-white font-extrabold flex items-center justify-center text-lg shadow-md shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
                }}
              >
                {user?.full_name?.[0] || 'S'}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-[#061430] truncate">{user?.full_name}</h3>
                <p className="text-xs text-slate-500 font-mono truncate">
                  {sp.index_number || 'UCC STUDENT'} • LEVEL {sp.academic_level || '300'}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold shrink-0">
              <Lock className="w-3 h-3" />
              <span>Official Record</span>
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-slate-700 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <span>
              These details come from your official student record. Contact the department if
              something is wrong.
            </span>
          </div>

          {/* Display-only official roster fields */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {[
              { label: 'Full Name', value: user?.full_name || '—' },
              { label: 'Index Number', value: sp.index_number || '—', mono: true },
              { label: 'University', value: user?.institution || 'University of Cape Coast' },
              { label: 'Programme', value: sp.programme_name || '—' },
              { label: 'Level', value: sp.academic_level ? `Level ${sp.academic_level}` : '—' },
              { label: 'Email', value: user?.email || '—', mono: true },
            ].map((item) => (
              <div
                key={item.label}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1"
              >
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>{item.label}</span>
                </dt>
                <dd
                  className={`text-sm font-semibold text-[#061430] break-words ${
                    item.mono ? 'font-mono' : ''
                  }`}
                >
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          {/* Editable Phone Number (SMS verified) */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Phone Number (SMS Verified)
                </p>
                <p className="text-sm font-mono font-bold text-[#061430] mt-0.5">
                  {user?.phone_number || 'Not set'}
                </p>
              </div>
              {!editingPhone && (
                <button
                  type="button"
                  onClick={() => {
                    setNewPhone(user?.phone_number || '');
                    setEditingPhone(true);
                    setPhoneOtpStep(false);
                  }}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {editingPhone && !phoneOtpStep && (
              <form onSubmit={handleRequestPhoneOtp} className="space-y-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    New Ghana Phone Number (e.g. 0241234567 or +233 24 123 4567)
                  </label>
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="0241234567"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={phoneSaving}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                  >
                    {phoneSaving ? 'Sending Code...' : 'Save & Send SMS Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPhone(false)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {editingPhone && phoneOtpStep && (
              <form onSubmit={handleConfirmPhoneOtp} className="space-y-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Enter 6-Digit SMS Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={phoneOtpCode}
                    onChange={(e) => setPhoneOtpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={phoneSaving}
                    className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{phoneSaving ? 'Verifying...' : 'Verify & Save'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPhone(false);
                      setPhoneOtpStep(false);
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Report incorrect details */}
          <div className="pt-2">
            {!reportOpen ? (
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>Report incorrect details</span>
              </button>
            ) : (
              <form
                onSubmit={handleReportSubmit}
                className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950">
                    Describe what needs correction on your official record
                  </span>
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    className="text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  rows={3}
                  required
                  maxLength={500}
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="e.g. My surname spelling or programme should be..."
                  className="w-full p-3 rounded-xl bg-white border border-amber-300 text-xs sm:text-sm focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  disabled={reportSending}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#061430] hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                >
                  {reportSending ? 'Sending...' : 'Send to Department Admin'}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div className="relative bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5 overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-700 via-blue-600 to-red-600" />
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
            <div
              className="w-12 h-12 rounded-2xl text-white font-extrabold flex items-center justify-center text-lg shadow-md"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
              }}
            >
              {user?.full_name?.[0] || 'U'}
            </div>
            <div>
              <h3 className="text-base font-bold text-[#061430]">{user?.full_name}</h3>
              <p className="text-xs text-slate-500 font-mono">
                {user?.email} • {user?.role}
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs sm:text-sm">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  University / Institution
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Staff ID (Verified)
                </label>
                <input
                  type="text"
                  disabled
                  value={user?.lecturer_profile?.staff_id || 'UCC-ADMIN'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 font-mono text-slate-600"
                />
              </div>
            </div>

            {user?.role === 'LECTURER' && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Office Location
                  </label>
                  <input
                    type="text"
                    value={officeLocation}
                    onChange={(e) => setOfficeLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs sm:text-sm transition hover:opacity-95 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #dc2626 100%)',
              }}
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Password Update */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-[#061430] flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-600" />
            <span>Change Password</span>
          </h3>
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="text-xs font-bold text-blue-700 inline-flex items-center gap-1 cursor-pointer"
          >
            {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showPw ? 'Hide' : 'Show'}</span>
          </button>
        </div>
        <form onSubmit={handleChangePassword} className="grid sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Current Password</label>
            <input
              type={showPw ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              New Password (8+ chars)
            </label>
            <input
              type={showPw ? 'text' : 'password'}
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Confirm New Password
            </label>
            <input
              type={showPw ? 'text' : 'password'}
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-600"
            />
          </div>
          <button
            type="submit"
            className="min-h-[44px] py-2.5 px-4 rounded-xl bg-[#061430] hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition cursor-pointer"
          >
            Change Password
          </button>
        </form>
      </div>

      {/* Email Change (Staff/Admin only — Student emails are locked to official roster) */}
      {!isStudent && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-extrabold text-[#061430] flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-700" />
            <span>Update Email Address</span>
          </h3>
          <form onSubmit={handleRequestEmailChange} className="grid sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                New Email Address (confirmation link will be sent here)
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new.email@ucc.edu.gh"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-600"
              />
            </div>
            <button
              type="submit"
              className="min-h-[44px] py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition cursor-pointer"
            >
              Send Confirmation Link
            </button>
          </form>
        </div>
      )}

      {/* Device Session */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-[#061430]">Device Session</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Your device stays signed in for 90 days unless you sign out here or an administrator
            revokes access.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            const redirectPath = await logout();
            addToast('Signed out of this device.', 'info');
            navigate(redirectPath || '/login');
          }}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm transition cursor-pointer shrink-0"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out of this device</span>
        </button>
      </div>
    </div>
  );
};

export default ProfileSettings;
