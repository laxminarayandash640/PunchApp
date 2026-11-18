import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AttendanceIQ — Sign In',
  description: 'Employee Attendance & Timesheet Management System',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
