import React from 'react';
import { ShieldCheck } from 'lucide-react';
import RoleLoginShell from '../../components/auth/RoleLoginShell';

const AdminLoginPage = () => (
  <RoleLoginShell
    roleKey="admin"
    expectedRoles={['ADMIN', 'DEPT_ADMIN']}
    badgeText="ADMIN PORTAL"
    headingPrefix="Administration"
    headingHighlight="Portal"
    subtitle="Restricted to authorized University of Cape Coast administrators."
    identifierLabel="Administrator Email"
    identifierPlaceholder="admin@ucc.edu.gh"
    icon={ShieldCheck}
    accentGradient="linear-gradient(90deg, #f87171 0%, #fbbf24 100%)"
    badgeStyle={{
      background: 'rgba(220, 38, 38, 0.25)',
      border: '1px solid rgba(248, 113, 113, 0.45)',
      color: '#fee2e2',
    }}
    focusRingColor="#f59e0b"
    buttonGradient="linear-gradient(135deg, #b91c1c 0%, #d97706 100%)"
    registerLink={null}
    forgotPasswordPath="/forgot-password?role=admin"
    pageTitle="Admin Portal Login | AttendX • UCC"
    noindex={true}
  />
);

export default AdminLoginPage;

