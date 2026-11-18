// ============================================================
// Core TypeScript Type Definitions
// Employee Attendance & Timesheet Management System
// ============================================================

// ------------------------------------------------------------------
// Profile
// ------------------------------------------------------------------
export interface Profile {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  department: string;
  designation: string;
  role: 'admin' | 'employee';
  joining_date: string; // ISO date string "YYYY-MM-DD"
  is_active: boolean;
  created_at: string;
  avatar_url?: string;
}

// ------------------------------------------------------------------
// Attendance
// ------------------------------------------------------------------
export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'holiday';

export interface Attendance {
  id: string;
  employee_id: string;
  attendance_date: string; // "YYYY-MM-DD"
  status: AttendanceStatus;
  total_working_seconds: number;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------
// AttendanceSession
// ------------------------------------------------------------------
export interface AttendanceSession {
  id: string;
  attendance_id: string;
  employee_id: string;
  punch_in: string;  // ISO timestamp
  punch_out: string | null; // null if still punched in
  duration_seconds: number | null; // null while session is open
  created_at: string;
}

// ------------------------------------------------------------------
// LeaveRequest
// ------------------------------------------------------------------
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  start_date: string;  // "YYYY-MM-DD"
  end_date: string;    // "YYYY-MM-DD"
  reason: string;
  status: LeaveStatus;
  approved_by: string | null;
  created_at: string;
  profiles?: Profile; // nested join
}

// ------------------------------------------------------------------
// CompanySettings
// ------------------------------------------------------------------
export interface CompanySettings {
  id: string;
  company_name: string;
  work_start_time: string;        // "HH:MM:SS"
  work_end_time: string;          // "HH:MM:SS"
  expected_working_hours: number; // in hours, e.g. 8
  grace_period_minutes: number;   // e.g. 15
  timezone: string;               // e.g. "Asia/Kolkata"
  working_days: number[];         // 0=Sun … 6=Sat, e.g. [1,2,3,4,5]
  allow_multiple_sessions: boolean;
  created_at: string;
}

// ------------------------------------------------------------------
// Composite / Extended Types
// ------------------------------------------------------------------
export type AttendanceWithSessions = Attendance & {
  sessions: AttendanceSession[];
  profile?: Profile;
};

// ------------------------------------------------------------------
// Dashboard Stats
// ------------------------------------------------------------------
export interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  currentlyWorking: number;
  totalWorkingHoursToday: number; // in seconds
}

// ------------------------------------------------------------------
// API Response helpers
// ------------------------------------------------------------------
export interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
}

// ------------------------------------------------------------------
// Pagination helpers
// ------------------------------------------------------------------
export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ------------------------------------------------------------------
// Filter helpers
// ------------------------------------------------------------------
export interface AttendanceFilter {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  status?: AttendanceStatus;
  department?: string;
}

export interface LeaveFilter {
  employeeId?: string;
  status?: LeaveStatus;
  startDate?: string;
  endDate?: string;
}
