import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { AttendanceSession } from '@/types';

// ----------------------------------------------------------------
// cn — className merger
// ----------------------------------------------------------------

/**
 * Merges Tailwind CSS class names, handling conflicts intelligently.
 * Wraps clsx (conditional logic) + tailwind-merge (conflict resolution).
 *
 * @example
 *   cn('px-2 py-1', isActive && 'bg-blue-500', 'px-4')
 *   // => 'py-1 bg-blue-500 px-4'  (px-2 is overridden by px-4)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ----------------------------------------------------------------
// Time formatting utilities
// ----------------------------------------------------------------

/**
 * Formats a duration in seconds to a human-readable string.
 * - Under 1 minute  → "45s"
 * - Under 1 hour    → "30m 15s"
 * - 1 hour or more  → "2h 30m" (seconds omitted for brevity)
 *
 * @param seconds - Total duration in seconds (non-negative integer).
 */
export function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (m > 0) {
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${s}s`;
}

/**
 * Formats a duration in seconds as HH:MM:SS (zero-padded).
 * Suitable for timesheets and clock-style displays.
 *
 * @example formatDuration(30600) → "08:30:00"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

// ----------------------------------------------------------------
// Date / DateTime formatting utilities
// ----------------------------------------------------------------

/**
 * Formats a date string "YYYY-MM-DD" to a human-readable label.
 *
 * @example formatDate("2026-11-18") → "Wed, 18 Nov 2026"
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';

  // Parse as a local date to avoid UTC offset shifting the day.
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Formats an ISO timestamp string to a human-readable date + time.
 *
 * @example formatDateTime("2026-11-18T09:30:00Z") → "18 Nov 2026, 09:30 AM"
 */
export function formatDateTime(isoStr: string): string {
  if (!isoStr) return '';

  const date = new Date(isoStr);

  const datePart = date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const timePart = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).toUpperCase();

  return `${datePart}, ${timePart}`;
}

// ----------------------------------------------------------------
// IST (Asia/Kolkata) helpers
// ----------------------------------------------------------------

/**
 * Returns the current Date object adjusted to IST (UTC+5:30).
 * Useful for display and date-string derivation on the server where the
 * system timezone may differ.
 */
export function getIST(): Date {
  const now = new Date();
  // Convert to IST by getting the UTC ms and adding +5:30 offset.
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30
  return new Date(utcMs + IST_OFFSET_MS);
}

/**
 * Returns today's date as "YYYY-MM-DD" in the IST timezone.
 * Always use this (instead of `new Date().toISOString().slice(0,10)`)
 * when recording attendance dates so they are consistent regardless of
 * where the server is running.
 */
export function getISTDateString(): string {
  const ist = getIST();
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, '0');
  const d = String(ist.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ----------------------------------------------------------------
// Business logic helpers
// ----------------------------------------------------------------

/**
 * Calculates the total working time in seconds across all attendance sessions.
 * - Closed sessions (punch_out is not null) contribute their `duration_seconds`.
 * - Open sessions (punch_out is null) are measured live against the current time.
 *
 * @param sessions - Array of AttendanceSession objects for one attendance record.
 * @returns Total seconds worked (rounded down).
 */
export function calculateWorkingHours(sessions: AttendanceSession[]): number {
  if (!sessions || sessions.length === 0) return 0;

  const now = Date.now();

  return sessions.reduce((total, session) => {
    if (session.duration_seconds !== null && session.duration_seconds >= 0) {
      return total + session.duration_seconds;
    }
    // Session is still open — compute live duration.
    const punchInMs = new Date(session.punch_in).getTime();
    const elapsed = Math.max(0, Math.floor((now - punchInMs) / 1000));
    return total + elapsed;
  }, 0);
}

// ----------------------------------------------------------------
// Status colour mapping
// ----------------------------------------------------------------

/**
 * Maps an attendance / leave status string to a Tailwind CSS colour
 * class pair (background + text) suitable for badges.
 *
 * Returns the full class string so Tailwind's JIT scanner can detect it
 * at build time.
 */
export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'present':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'absent':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'leave':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'holiday':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'pending':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'active':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'inactive':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

// ----------------------------------------------------------------
// ID generation
// ----------------------------------------------------------------

/**
 * Generates a sequential-looking employee ID string.
 * In production this should be replaced with a server-side sequence
 * (e.g. querying the max existing employee_id from the database).
 *
 * @param sequence - Optional numeric sequence; defaults to a random 3-digit number.
 * @returns Employee ID string, e.g. "EMP042"
 */
export function generateEmployeeId(sequence?: number): string {
  const seq =
    sequence !== undefined
      ? sequence
      : Math.floor(Math.random() * 900) + 100; // 100–999
  return `EMP${String(seq).padStart(3, '0')}`;
}
