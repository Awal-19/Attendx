import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Save, LogOut } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const ProfileSettings = () => {
  const { user, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

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

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

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
    } catch {
      addToast('Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      addToast('Password changed successfully!', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not update password.', 'error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-[#061430]">Account &amp; Profile Settings</h2>
        <p className="text-sm text-slate-500">
          Manage your university identity details and security credentials
        </p>
      </div>

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
                {user?.role === 'STUDENT' ? 'Index Number (Verified)' : 'Staff ID (Verified)'}
              </label>
              <input
                type="text"
                disabled
                value={
                  user?.student_profile?.index_number ||
                  user?.lecturer_profile?.staff_id ||
                  'UCC-ADMIN'
                }
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

      {/* Password Update */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <h3 className="text-base font-extrabold text-[#061430] flex items-center gap-2">
          <Lock className="w-4 h-4 text-red-600" />
          <span>Update Account Password</span>
        </h3>
        <form onSubmit={handleChangePassword} className="grid sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              New Password (Min 8 chars)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-600"
            />
          </div>
          <button
            type="submit"
            className="py-2.5 px-4 rounded-xl bg-[#061430] hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition cursor-pointer"
          >
            Change Password
          </button>
        </form>
      </div>

      {/* Device Session */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
