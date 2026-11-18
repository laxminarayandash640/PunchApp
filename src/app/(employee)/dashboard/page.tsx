'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { PunchCard } from '@/components/attendance/PunchCard';
import { StatsCard } from '@/components/ui/StatsCard';
import { WorkingHoursChart } from '@/components/charts/WorkingHoursChart';
import { Clock, Calendar, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatTime } from '@/lib/utils';
import type { AttendanceWithSessions } from '@/types';

export default function EmployeeDashboardPage() {
  const { profile } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<AttendanceWithSessions | null>(null);
  const [loading, setLoading] = useState(true);
  const [punchLoading, setPunchLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [weekHours, setWeekHours] = useState(0);
  const [monthHours, setMonthHours] = useState(0);
  const [chartData, setChartData] = useState<{ name: string; hours: number }[]>([]);

  // Fetch today's attendance
  const fetchTodayData = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/today');
      if (res.ok) {
        const json = await res.json();
        setTodayAttendance(json.attendance);
      }
    } catch (err) {
      console.error('Failed to load today attendance:', err);
    }
  }, []);

  // Fetch weekly/monthly summaries & chart data
  const fetchSummaryData = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/history?limit=30');
      if (res.ok) {
        const json = await res.json();
        const records: AttendanceWithSessions[] = json.records || [];

        // Calculate this week's hours
        const now = new Date();
        const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const weekStartStr = firstDayOfWeek.toISOString().split('T')[0];
        const monthStartStr = new Date().toISOString().slice(0, 7) + '-01';

        let wSecs = 0;
        let mSecs = 0;

        // Last 7 days chart array
        const daysMap: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().split('T')[0];
          const shortName = d.toLocaleDateString('en-IN', { weekday: 'short' });
          daysMap[key] = 0;
        }

        records.forEach((r) => {
          if (r.attendance_date >= weekStartStr) {
            wSecs += r.total_working_seconds || 0;
          }
          if (r.attendance_date >= monthStartStr) {
            mSecs += r.total_working_seconds || 0;
          }
          if (daysMap[r.attendance_date] !== undefined) {
            daysMap[r.attendance_date] = Number(((r.total_working_seconds || 0) / 3600).toFixed(1));
          }
        });

        setWeekHours(wSecs);
        setMonthHours(mSecs);

        const chart = Object.keys(daysMap).map((k) => {
          const d = new Date(k);
          return {
            name: d.toLocaleDateString('en-IN', { weekday: 'short' }),
            hours: daysMap[k],
          };
        });
        setChartData(chart);
      }
    } catch (err) {
      console.error('Failed to load history summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayData();
    fetchSummaryData();
  }, [fetchTodayData, fetchSummaryData]);

  // Handle Punch In
  const handlePunchIn = async () => {
    setErrorMsg(null);
    setPunchLoading(true);
    try {
      const res = await fetch('/api/attendance/punch-in', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to punch in');
      }
      await fetchTodayData();
      await fetchSummaryData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error punching in');
    } finally {
      setPunchLoading(false);
    }
  };

  // Handle Punch Out
  const handlePunchOut = async () => {
    setErrorMsg(null);
    setPunchLoading(true);
    try {
      const res = await fetch('/api/attendance/punch-out', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to punch out');
      }
      await fetchTodayData();
      await fetchSummaryData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error punching out');
    } finally {
      setPunchLoading(false);
    }
  };

  return (
    <EmployeeLayout>
      {/* Alert banner if any */}
      {errorMsg && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Punch Section */}
      <PunchCard
        attendance={todayAttendance}
        onPunchIn={handlePunchIn}
        onPunchOut={handlePunchOut}
        loading={punchLoading}
      />

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Today's Status"
          value={todayAttendance ? todayAttendance.status.toUpperCase() : 'NOT RECORDED'}
          subtitle={todayAttendance?.sessions?.find((s) => !s.punch_out) ? 'Session active' : 'Shift logged'}
          icon={<CheckCircle className="w-5 h-5" />}
          color="emerald"
        />
        <StatsCard
          title="Hours Today"
          value={formatTime(todayAttendance?.total_working_seconds || 0)}
          subtitle="Calculated in real-time"
          icon={<Clock className="w-5 h-5" />}
          color="blue"
        />
        <StatsCard
          title="This Week"
          value={formatTime(weekHours)}
          subtitle="Weekly logged hours"
          icon={<Calendar className="w-5 h-5" />}
          color="purple"
        />
        <StatsCard
          title="This Month"
          value={formatTime(monthHours)}
          subtitle="Monthly total hours"
          icon={<TrendingUp className="w-5 h-5" />}
          color="amber"
        />
      </div>

      {/* Weekly Working Hours Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Weekly Hours Trend
            </h3>
            <p className="text-xs text-slate-400">Daily working duration for the past 7 days</p>
          </div>
        </div>
        <div className="pt-4">
          <WorkingHoursChart data={chartData} />
        </div>
      </div>
    </EmployeeLayout>
  );
}
