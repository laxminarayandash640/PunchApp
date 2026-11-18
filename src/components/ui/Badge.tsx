import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function Badge({ status, className, size = 'md' }: BadgeProps) {
  const normalized = status.toLowerCase();

  const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    present: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      text: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      label: 'Present',
    },
    working: {
      bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-300',
      dot: 'bg-blue-500 animate-pulse',
      label: 'Currently Working',
    },
    completed: {
      bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
      text: 'text-indigo-700 dark:text-indigo-300',
      dot: 'bg-indigo-500',
      label: 'Completed',
    },
    absent: {
      bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
      text: 'text-rose-700 dark:text-rose-300',
      dot: 'bg-rose-500',
      label: 'Absent',
    },
    leave: {
      bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
      label: 'On Leave',
    },
    holiday: {
      bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
      text: 'text-purple-700 dark:text-purple-300',
      dot: 'bg-purple-500',
      label: 'Holiday',
    },
    pending: {
      bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
      label: 'Pending',
    },
    approved: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      text: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      label: 'Approved',
    },
    rejected: {
      bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
      text: 'text-rose-700 dark:text-rose-300',
      dot: 'bg-rose-500',
      label: 'Rejected',
    },
    active: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      text: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      label: 'Active',
    },
    inactive: {
      bg: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
      text: 'text-slate-600 dark:text-slate-400',
      dot: 'bg-slate-400',
      label: 'Inactive',
    },
  };

  const current = config[normalized] || {
    bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
    text: 'text-slate-700',
    dot: 'bg-slate-400',
    label: status.charAt(0).toUpperCase() + status.slice(1),
  };

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border',
        sizeClass,
        current.bg,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', current.dot)} />
      {current.label}
    </span>
  );
}
