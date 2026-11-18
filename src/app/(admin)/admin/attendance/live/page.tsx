'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { LiveAttendanceTable, LiveEmployeeAttendance } from '@/components/admin/LiveAttendanceTable';
import { Radio, Users, CheckCircle2, Clock, UserX, CalendarOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile, AttendanceWithSessions } from '@/types';

export default function AdminLiveAttendancePage() {
  const [records, setRecords] = useState<LiveEmployeeAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const supabase = createClient();

  const loadLiveData = useCallback(async () => {
    try {
      // 1. Fetch all active employees
      const empRes = await fetch('/api/employees');
      const empJson = await empRes.json();
      const employees: Profile[] = empJson.employees || [];

      // 2. Fetch today's attendance for all employees
      const attRes = await fetch('/api/admin/attendance?limit=200');
      const attJson = await attRes.json();
      const attendanceList: AttendanceWithSessions[] = attJson.records || [];

      const attMap = new Map<string, AttendanceWithSessions>();
      attendanceList.forEach((a) => attMap.set(a.employee_id, a));

      // 3. Construct live items
      const liveItems: LiveEmployeeAttendance[] = employees.map((emp) => {
        const att = attMap.get(emp.id) || null;
        const sessions = att?.sessions || [];
        const activeSession = sessions.find((s) => !s.punch_out);

        let status: 'present' | 'absent' | 'working' | 'completed' | 'leave' = 'absent';
        if (att?.status === 'leave') {
          status = 'leave';
        } else if (activeSession) {
          status = 'working';
        } else if (sessions.length > 0) {
          status = 'completed';
        } else if (att?.status === 'present') {
          status = 'present';
        }

        const firstPunchIn = sessions[0]?.punch_in || null;
        const lastPunchOut = sessions[sessions.length - 1]?.punch_out || null;
        const workingHoursSeconds = att?.total_working_seconds || 0;

        let lastActivity = 'No activity today';
        if (activeSession) {
          lastActivity = `Punched in at ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }).format(new Date(activeSession.punch_in))}`;
        } else if (lastPunchOut) {
          lastActivity = `Punched out at ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }).format(new Date(lastPunchOut))}`;
        }

        return {
          profile: emp,
          attendance: att,
          status,
          firstPunchIn,
          lastPunchOut,
          workingHoursSeconds,
          lastActivity,
        };
      });

      // Sort by status priority: working first, then present, completed, leave, absent
      const order = { working: 0, present: 1, completed: 2, leave: 3, absent: 4 };
      liveItems.sort((a, b) => order[a.status] - order[b.status]);

      setRecords(liveItems);
      setLastUpdated(
        new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(new Date())
      );
    } catch (err) {
      console.error('Failed to load live attendance data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLiveData();

    // Subscribe to attendance_sessions changes via Supabase Realtime
    const channel = supabase
      .channel('attendance_live_stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_sessions' },
        () => {
          loadLiveData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => {
          loadLiveData();
        }
      )
      .subscribe();

    // Fallback polling every 8 seconds
    const interval = setInterval(loadLiveData, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [loadLiveData, supabase]);

  const totalEmployees = records.length;
  const currentlyWorking = records.filter((r) => r.status === 'working').length;
  const completed = records.filter((r) => r.status === 'completed').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const onLeave = records.filter((r) => r.status === 'leave').length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                Live Attendance Stream
              </h1>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Immediate visibility into workforce check-ins, active work shifts, and departures
            </p>
          </div>
        </div>

        {/* Live Counters Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Currently Working</p>
              <p className="text-lg font-bold text-blue-600">{currentlyWorking}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Completed Shift</p>
              <p className="text-lg font-bold text-emerald-600">{completed}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Absent Today</p>
              <p className="text-lg font-bold text-rose-600">{absent}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600">
              <CalendarOff className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">On Leave</p>
              <p className="text-lg font-bold text-amber-600">{onLeave}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Workforce</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{totalEmployees}</p>
            </div>
          </div>
        </div>

        {/* Live Attendance Table Component */}
        <LiveAttendanceTable
          records={records}
          loading={loading}
          onRefresh={loadLiveData}
          lastUpdated={lastUpdated}
        />
      </div>
    </AdminLayout>
  );
}
