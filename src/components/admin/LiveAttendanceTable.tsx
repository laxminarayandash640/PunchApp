'use client';

import React, { useState } from 'react';
import { Radio, RefreshCw, Search } from 'lucide-react';
import { Table, Column } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { formatTime, formatDuration } from '@/lib/utils';
import type { AttendanceWithSessions, Profile } from '@/types';

export interface LiveEmployeeAttendance {
  profile: Profile;
  attendance: AttendanceWithSessions | null;
  status: 'present' | 'absent' | 'working' | 'completed' | 'leave';
  firstPunchIn: string | null;
  lastPunchOut: string | null;
  workingHoursSeconds: number;
  lastActivity: string;
}

interface LiveAttendanceTableProps {
  records: LiveEmployeeAttendance[];
  loading?: boolean;
  onRefresh?: () => void;
  lastUpdated?: string;
}

export function LiveAttendanceTable({
  records,
  loading = false,
  onRefresh,
  lastUpdated,
}: LiveAttendanceTableProps) {
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  // Extract unique departments
  const departments = Array.from(
    new Set(records.map((r) => r.profile.department).filter(Boolean))
  );

  const filtered = records.filter((r) => {
    if (filterDepartment !== 'all' && r.profile.department !== filterDepartment) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.profile.full_name.toLowerCase().includes(q) ||
        r.profile.employee_id.toLowerCase().includes(q) ||
        r.profile.department?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const columns: Column<LiveEmployeeAttendance>[] = [
    {
      key: 'employee',
      header: 'Employee Name & ID',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0">
            {r.profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{r.profile.full_name}</p>
            <p className="text-xs text-slate-400 font-mono">{r.profile.employee_id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (r) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {r.profile.department || 'General'}
        </span>
      ),
    },
    {
      key: 'punch_in',
      header: 'Punch-In Time',
      render: (r) => (
        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
          {r.firstPunchIn
            ? new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              }).format(new Date(r.firstPunchIn))
            : '--:--'}
        </span>
      ),
    },
    {
      key: 'punch_out',
      header: 'Punch-Out Time',
      render: (r) => (
        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
          {r.lastPunchOut
            ? new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              }).format(new Date(r.lastPunchOut))
            : '--:--'}
        </span>
      ),
    },
    {
      key: 'working_hours',
      header: 'Working Hours',
      render: (r) => (
        <div className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
          {formatDuration(r.workingHoursSeconds)}
          <span className="text-[11px] text-slate-400 font-sans ml-1">
            ({formatTime(r.workingHoursSeconds)})
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Current Status',
      render: (r) => <Badge status={r.status} size="sm" />,
    },
    {
      key: 'last_activity',
      header: 'Last Activity',
      render: (r) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">{r.lastActivity}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Realtime status bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Realtime Attendance Stream
          </span>
          {lastUpdated && (
            <span className="text-xs text-slate-400 ml-2">Updated: {lastUpdated}</span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Statuses</option>
            <option value="working">Currently Working</option>
            <option value="present">Present (All)</option>
            <option value="absent">Absent</option>
            <option value="completed">Completed Shift</option>
            <option value="leave">On Leave</option>
          </select>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={filtered}
        loading={loading}
        emptyMessage="No employees found matching the current live filter."
        rowKey={(r) => r.profile.id}
      />
    </div>
  );
}
