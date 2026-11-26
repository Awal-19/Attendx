import React from 'react';
import { GraduationCap } from 'lucide-react';
import RoleLoginShell from '../../components/auth/RoleLoginShell';

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
    accentGradient="linear-gradient(90deg, #60a5fa 0%, #818cf8 100%)"
    badgeStyle={{
      background: 'rgba(37, 99, 235, 0.25)',
      border: '1px solid rgba(96, 165, 250, 0.45)',
      color: '#dbeafe',
    }}
    focusRingColor="#60a5fa"
    buttonGradient="linear-gradient(135deg, #1d4ed8 0%, #4f46e5 100%)"
    registerLink={{ to: '/register/student', label: 'Register as a student →' }}
    forgotPasswordPath="/forgot-password?role=student"
    pageTitle="Student Login | AttendX • UCC"
    noindex={false}
  />
);

export default StudentLoginPage;

