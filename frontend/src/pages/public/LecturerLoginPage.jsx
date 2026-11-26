import React from 'react';
import { BookOpen } from 'lucide-react';
import RoleLoginShell from '../../components/auth/RoleLoginShell';

const LecturerLoginPage = () => (
  <RoleLoginShell
    roleKey="lecturer"
    expectedRoles={['LECTURER']}
    badgeText="LECTURER PORTAL"
    headingPrefix="Lecturer"
    headingHighlight="Portal"
    subtitle="Sign in with your UCC faculty email to manage courses and live QR sessions."
    identifierLabel="Faculty Email or Staff ID"
    identifierPlaceholder="lecturer@ucc.edu.gh"
    icon={BookOpen}
    accentGradient="linear-gradient(90deg, #34d399 0%, #2dd4bf 100%)"
    badgeStyle={{
      background: 'rgba(16, 185, 129, 0.22)',
      border: '1px solid rgba(52, 211, 153, 0.45)',
      color: '#d1fae5',
    }}
    focusRingColor="#34d399"
    buttonGradient="linear-gradient(135deg, #059669 0%, #0d9488 100%)"
    registerLink={{ to: '/register/lecturer', label: 'Register as a lecturer →' }}
    forgotPasswordPath="/forgot-password?role=lecturer"
    pageTitle="Lecturer Login | AttendX • UCC"
    noindex={true}
  />
);

export default LecturerLoginPage;

