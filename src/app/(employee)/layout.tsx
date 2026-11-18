import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AttendanceIQ — Dashboard',
  description: 'Employee Attendance & Timesheet Management System',
};

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
