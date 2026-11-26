import React from 'react';
import { ShieldCheck } from 'lucide-react';
import RoleLoginShell from '../../components/auth/RoleLoginShell';
import UccAdminBackground from '../../components/auth/UccAdminBackground';
import '../../styles/uccLiquidGlass.css';

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
    accentGradient="linear-gradient(90deg, #dc2626 0%, #ffffff 50%, #60a5fa 100%)"
    badgeStyle={{
      background:
        'linear-gradient(90deg, rgba(153, 27, 27, 0.65) 0%, rgba(15, 23, 42, 0.72) 100%)',
      border: '1px solid rgba(245, 158, 11, 0.45)',
      color: '#ffffff',
    }}
    focusRingColor="#f59e0b"
    buttonGradient="linear-gradient(135deg, #991b1b 0%, #1e3a8a 100%)"
    registerLink={null}
    forgotPasswordPath="/forgot-password?role=admin"
    pageTitle="Admin Portal Login | AttendX • UCC"
    noindex={true}
    customRootClass="ucc-theme-root"
    backgroundNode={
      <UccAdminBackground overlayGradient="linear-gradient(135deg, rgba(90, 16, 24, 0.68) 0%, rgba(7, 13, 30, 0.72) 55%, rgba(20, 38, 92, 0.64) 100%)" />
    }
    footerLogoSrc="/images/ucc-official-crest.png"
    footerLogoAlt="University of Cape Coast crest"
    cardClassName="ucc-liquid-glass ucc-liquid-glass--admin"
    inputClassName="ucc-glass-input"
    forgotLinkClassName="!text-amber-300 hover:!text-white !decoration-amber-400"
    checkboxClassName="!accent-amber-500"
    submitButtonClassName="ucc-submit-btn"
    headerClassName="ucc-header-glass"
  />
);

export default AdminLoginPage;
