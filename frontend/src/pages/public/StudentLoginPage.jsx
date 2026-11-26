import React from 'react';
import { GraduationCap } from 'lucide-react';
import RoleLoginShell from '../../components/auth/RoleLoginShell';
import UccAdminBackground from '../../components/auth/UccAdminBackground';
import '../../styles/uccLiquidGlass.css';

const StudentLoginPage = () => (
  <RoleLoginShell
    roleKey="student"
    expectedRoles={['STUDENT']}
    badgeText="STUDENT PORTAL"
    headingPrefix="Student"
    headingHighlight="Login"
    subtitle="Sign in with your UCC Index Number or student email to mark attendance."
    identifierLabel="Index Number or Student Email"
    identifierPlaceholder="PS/CSC/24/0044 or student@stu.ucc.edu.gh"
    icon={GraduationCap}
    accentGradient="linear-gradient(90deg, #f87171 0%, #fbbf24 50%, #93c5fd 100%)"
    badgeStyle={{
      background:
        'linear-gradient(90deg, rgba(185, 28, 28, 0.45) 0%, rgba(30, 58, 138, 0.50) 100%)',
      border: '1px solid rgba(245, 158, 11, 0.55)',
      color: '#ffffff',
    }}
    focusRingColor="#f59e0b"
    buttonGradient="linear-gradient(135deg, #b91c1c 0%, #1e3a8a 82%, #d97706 100%)"
    registerLink={{ to: '/register/student', label: 'Register as a student →' }}
    forgotPasswordPath="/forgot-password?role=student"
    pageTitle="Student Login | AttendX • UCC"
    noindex={false}
    customRootClass="ucc-theme-root"
    backgroundNode={<UccAdminBackground />}
    footerLogoSrc="/images/ucc-official-crest.png"
    footerLogoAlt="University of Cape Coast crest"
    cardClassName="ucc-liquid-glass"
    inputClassName="ucc-glass-input"
    forgotLinkClassName="!text-amber-300 hover:!text-white !decoration-amber-400"
    checkboxClassName="!accent-amber-500"
    registerButtonClassName="ucc-glass-secondary-btn"
    submitButtonClassName="ucc-submit-btn"
    headerClassName="ucc-header-glass"
  />
);

export default StudentLoginPage;
