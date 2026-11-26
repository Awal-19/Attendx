import React from 'react';
import { BookOpen } from 'lucide-react';
import RoleLoginShell from '../../components/auth/RoleLoginShell';
import UccAdminBackground from '../../components/auth/UccAdminBackground';
import '../../styles/uccLiquidGlass.css';

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
    accentGradient="linear-gradient(90deg, #fbbf24 0%, #f59e0b 55%, #fde68a 100%)"
    badgeStyle={{
      background:
        'linear-gradient(90deg, rgba(217, 119, 6, 0.42) 0%, rgba(30, 58, 138, 0.48) 100%)',
      border: '1px solid rgba(251, 191, 36, 0.65)',
      color: '#fef3c7',
    }}
    focusRingColor="#f59e0b"
    buttonGradient="linear-gradient(135deg, #1e3a8a 0%, #b91c1c 75%, #d97706 100%)"
    registerLink={{ to: '/register/lecturer', label: 'Register as a lecturer →' }}
    forgotPasswordPath="/forgot-password?role=lecturer"
    pageTitle="Lecturer Login | AttendX • UCC"
    noindex={true}
    customRootClass="ucc-theme-root"
    backgroundNode={
      <UccAdminBackground overlayGradient="linear-gradient(135deg, rgba(30, 58, 138, 0.54) 0%, rgba(15, 23, 42, 0.58) 52%, rgba(146, 64, 14, 0.42) 100%)" />
    }
    footerLogoSrc="/images/ucc-official-crest.png"
    footerLogoAlt="University of Cape Coast crest"
    cardClassName="ucc-liquid-glass ucc-liquid-glass--lecturer"
    inputClassName="ucc-glass-input"
    forgotLinkClassName="!text-amber-300 hover:!text-white !decoration-amber-400"
    checkboxClassName="!accent-amber-500"
    registerButtonClassName="ucc-glass-secondary-btn"
    submitButtonClassName="ucc-submit-btn"
    headerClassName="ucc-header-glass"
  />
);

export default LecturerLoginPage;
