import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Sliders,
  Trash2,
  CheckCircle2,
  XCircle,
  Users,
  AlertTriangle,
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const BiometricManagement = () => {
  const { addToast } = useToast();
  const [overview, setOverview] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [config, setConfig] = useState({
    similarity_threshold: 0.38,
    liveness_required: true,
    retention_days: 365,
    allow_non_biometric_alternative: true,
  });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [ovRes, attRes] = await Promise.all([
        api.get('/biometrics/admin/overview/'),
        api.get('/biometrics/admin/attempts/'),
      ]);
      setOverview(ovRes.data);
      if (ovRes.data?.config) {
        setConfig(ovRes.data.config);
      }
      setAttempts(attRes.data);
    } catch {
      addToast('Failed to load biometric management data.', 'error');
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/biometrics/admin/config/', config);
      addToast('Biometric security & retention settings updated!', 'success');
      loadData();
    } catch {
      addToast('Could not update biometric configuration.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePurgeExpired = async () => {
    try {
      const res = await api.post('/biometrics/admin/purge-expired/');
      addToast(res.data.message, 'info');
      loadData();
    } catch {
      addToast('Failed to purge expired templates.', 'error');
    }
  };

  const handleResolveDispute = async (id, decision) => {
    try {
      await api.patch(`/biometrics/admin/disputes/${id}/`, {
        dispute_status: decision,
        dispute_notes:
          decision === 'RESOLVED_APPROVED'
            ? 'Verified and approved by Super Admin'
            : 'Rejected after review by Super Admin',
      });
      addToast(`Dispute ${decision === 'RESOLVED_APPROVED' ? 'approved' : 'rejected'}.`, 'success');
      loadData();
    } catch {
      addToast('Could not resolve dispute.', 'error');
    }
  };

  const es = overview?.enrollment_stats || {};
  const vs = overview?.verification_stats || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#061430]">
            Biometric Verification &amp; Privacy Governance
          </h2>
          <p className="text-sm text-slate-500">
            Monitor student biometric enrollment, verification accuracy, retention policies, and
            disputes (raw templates are encrypted and never exposed)
          </p>
        </div>

        <button
          onClick={handlePurgeExpired}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
        >
          <Trash2 className="w-4 h-4" />
          <span>Purge Expired Templates</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-blue-700" />
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500">
            <span>Enrolled Students</span>
            <Users className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-3xl font-extrabold text-[#061430] mt-2">{es.enrolled ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">{es.opted_out ?? 0} opted out (manual)</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-blue-500" />
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500">
            <span>Successful Matches</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-3xl font-extrabold text-blue-700 mt-2">{vs.success ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">Out of {vs.total_attempts ?? 0} attempts</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-red-600" />
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500">
            <span>Spoof / Liveness Blocks</span>
            <ShieldCheck className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-3xl font-extrabold text-red-600 mt-2">{vs.failed_liveness ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">{vs.failed_mismatch ?? 0} face mismatches</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-amber-500" />
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500">
            <span>Open Disputes</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-extrabold text-[#061430] mt-2">{vs.open_disputes ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">Awaiting admin review</p>
        </div>
      </div>

      {/* Configurable Settings */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h3 className="text-base font-extrabold text-[#061430] flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-700" />
          <span>Biometric Thresholds &amp; Retention Policy</span>
        </h3>

        <form onSubmit={handleSaveConfig} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              1:1 Cosine Threshold (0.20 – 0.85)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.20"
              max="0.85"
              value={config.similarity_threshold}
              onChange={(e) =>
                setConfig({ ...config, similarity_threshold: parseFloat(e.target.value) })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Template Retention (Days)
            </label>
            <input
              type="number"
              min="30"
              max="1825"
              value={config.retention_days}
              onChange={(e) =>
                setConfig({ ...config, retention_days: parseInt(e.target.value, 10) })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.liveness_required}
                onChange={(e) => setConfig({ ...config, liveness_required: e.target.checked })}
                className="w-4 h-4 accent-blue-700"
              />
              <span>Require Liveness Detection</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.allow_non_biometric_alternative}
                onChange={(e) =>
                  setConfig({ ...config, allow_non_biometric_alternative: e.target.checked })
                }
                className="w-4 h-4 accent-blue-700"
              />
              <span>Allow Non-Biometric Alternative</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="py-2.5 px-5 rounded-xl text-white font-bold text-xs sm:text-sm cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 65%, #dc2626 100%)',
            }}
          >
            {saving ? 'Saving...' : 'Save Biometric Policy'}
          </button>
        </form>
      </div>

      {/* Verification Attempts & Disputes Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-extrabold text-[#061430]">
            Recent Verification Attempts &amp; Disputes
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-5">Student</th>
                <th className="py-3 px-5">Course</th>
                <th className="py-3 px-5">Result</th>
                <th className="py-3 px-5">Similarity / Liveness</th>
                <th className="py-3 px-5">Dispute</th>
                <th className="py-3 px-5 text-right">Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs sm:text-sm">
              {attempts.map((a) => (
                <tr key={a.id} className="hover:bg-blue-50/35">
                  <td className="py-3 px-5">
                    <p className="font-bold text-[#061430]">{a.student_name}</p>
                    <p className="font-mono text-xs text-blue-700">{a.student_index_number}</p>
                  </td>
                  <td className="py-3 px-5 font-mono text-xs font-bold">{a.course_code}</td>
                  <td className="py-3 px-5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        a.result === 'SUCCESS'
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {a.result}
                    </span>
                  </td>
                  <td className="py-3 px-5 font-mono text-xs">
                    {a.similarity_score !== null ? `${a.similarity_score}` : '—'} •{' '}
                    {a.liveness_passed ? 'Live' : 'No'}
                  </td>
                  <td className="py-3 px-5 text-xs font-bold">{a.dispute_status}</td>
                  <td className="py-3 px-5 text-right space-x-1.5">
                    {a.dispute_status === 'OPEN' && (
                      <>
                        <button
                          onClick={() => handleResolveDispute(a.id, 'RESOLVED_APPROVED')}
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer"
                          title="Approve & Mark Present"
                        >
                          <CheckCircle2 className="w-4 h-4 inline" />
                        </button>
                        <button
                          onClick={() => handleResolveDispute(a.id, 'RESOLVED_REJECTED')}
                          className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                          title="Reject Dispute"
                        >
                          <XCircle className="w-4 h-4 inline" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BiometricManagement;

