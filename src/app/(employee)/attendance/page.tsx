'use client';

import React, { useState, useEffect } from 'react';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { AttendanceTable } from '@/components/attendance/AttendanceTable';
import { StatsCard } from '@/components/ui/StatsCard';
import { CalendarCheck, Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import type { AttendanceWithSessions } from '@/types';

export default function MyAttendancePage() {
  const [records, setRecords] = useState<AttendanceWithSessions[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/attendance/history?limit=100');
        if (res.ok) {
          const json = await res.json();
          setRecords(json.records || []);
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute stats
  const totalDays = records.length;
  const presentDays = records.filter((r) => r.status === 'present').length;
  const absentDays = records.filter((r) => r.status === 'absent').length;
  const totalWorkingSeconds = records.reduce((acc, r) => acc + (r.total_working_seconds || 0), 0);

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            My Attendance History
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            View, filter, and export your personal attendance and punch logs
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Logged Days"
            value={totalDays}
            subtitle="Recorded in system"
            icon={<CalendarCheck className="w-5 h-5" />}
            color="blue"
          />
          <StatsCard
            title="Present Days"
            value={presentDays}
            subtitle={totalDays > 0 ? `${Math.round((presentDays / totalDays) * 100)}% attendance rate` : 'N/A'}
            icon={<CheckCircle className="w-5 h-5" />}
            color="emerald"
          />
          <StatsCard
            title="Absent Days"
            value={absentDays}
            subtitle="Unscheduled absences"
            icon={<XCircle className="w-5 h-5" />}
            color="rose"
          />
          <StatsCard
            title="Total Hours Logged"
            value={formatTime(totalWorkingSeconds)}
            subtitle="Accumulated duration"
            icon={<Clock className="w-5 h-5" />}
            color="purple"
          />
        </div>

        {/* Attendance Records Table */}
        <AttendanceTable records={records} loading={loading} />
      </div>
    </EmployeeLayout>
  );
}
