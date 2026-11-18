'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { Button } from '@/components/ui/Button';
import { Table, Column } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Download, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, formatTime, formatDuration } from '@/lib/utils';
import type { AttendanceWithSessions } from '@/types';

export default function EmployeeTimesheetPage() {
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [records, setRecords] = useState<AttendanceWithSessions[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/attendance/history?limit=150');
        if (res.ok) {
          const json = await res.json();
          setRecords(json.records || []);
        }
      } catch (err) {
        console.error('Failed to load records:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute Week range based on offset
  const weekDays = useMemo(() => {
    const curr = new Date();
    // Monday as start
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1) + currentWeekOffset * 7;
    const monday = new Date(curr.setDate(diff));

    const days: { dateStr: string; label: string; dayName: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });
      days.push({ dateStr, label, dayName });
    }
    return days;
  }, [currentWeekOffset]);

  // Map records to days
  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceWithSessions>();
    records.forEach((r) => map.set(r.attendance_date, r));
    return map;
  }, [records]);

  // Weekly total seconds
  const weeklyTotalSeconds = weekDays.reduce((acc, d) => {
    const rec = recordMap.get(d.dateStr);
    return acc + (rec?.total_working_seconds || 0);
  }, 0);

  // Export Timesheet to CSV
  const handleExport = () => {
    const headers = ['Day', 'Date', 'Status', 'First Punch In', 'Last Punch Out', 'Duration (Hours)', 'Duration (HH:MM:SS)'];
    const rows = weekDays.map((d) => {
      const rec = recordMap.get(d.dateStr);
      const firstIn = rec?.sessions?.[0]?.punch_in ? new Date(rec.sessions[0].punch_in).toLocaleTimeString('en-IN') : '--';
      const lastOut = rec?.sessions?.[rec.sessions.length - 1]?.punch_out
        ? new Date(rec.sessions[rec.sessions.length - 1].punch_out!).toLocaleTimeString('en-IN')
        : '--';
      return [
        d.dayName,
        d.dateStr,
        rec ? rec.status : 'Absent/Off',
        firstIn,
        lastOut,
        rec ? (rec.total_working_seconds / 3600).toFixed(2) : '0',
        formatDuration(rec?.total_working_seconds || 0),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `my_timesheet_${weekDays[0].dateStr}_to_${weekDays[6].dateStr}.csv`;
    link.click();
  };

  const monthlyColumns: Column<AttendanceWithSessions>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{formatDate(r.attendance_date)}</p>
          <p className="text-xs text-slate-400 font-mono">{r.attendance_date}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge status={r.status} size="sm" />,
    },
    {
      key: 'hours',
      header: 'Working Hours',
      render: (r) => (
        <span className="font-mono font-semibold text-sm text-slate-800 dark:text-slate-200">
          {formatDuration(r.total_working_seconds)} ({formatTime(r.total_working_seconds)})
        </span>
      ),
    },
    {
      key: 'sessions',
      header: 'Sessions Count',
      render: (r) => `${r.sessions?.length || 0} session(s)`,
    },
  ];

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              My Timesheet
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Review and audit your working durations, daily breakdown, and weekly logs
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center">
              <button
                onClick={() => setViewMode('weekly')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === 'weekly'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Weekly View
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === 'monthly'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Monthly History
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleExport}
            >
              Export Timesheet
            </Button>
          </div>
        </div>

        {viewMode === 'weekly' ? (
          <div className="space-y-4">
            {/* Week navigation header */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setCurrentWeekOffset((p) => p - 1)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" /> Previous Week
              </button>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  {weekDays[0].label} – {weekDays[6].label}
                </span>
                {currentWeekOffset === 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                    Current Week
                  </span>
                )}
              </div>

              <button
                onClick={() => setCurrentWeekOffset((p) => p + 1)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Next Week <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekly Daily Cards / Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="grid grid-cols-7 divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 text-center">
                {weekDays.map((d) => (
                  <div key={d.dateStr} className="p-3">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">{d.dayName}</p>
                    <p className="text-xs text-slate-400 font-medium">{d.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 divide-x divide-slate-100 dark:divide-slate-800 min-h-[140px]">
                {weekDays.map((d) => {
                  const rec = recordMap.get(d.dateStr);
                  const isPresent = rec?.status === 'present';
                  return (
                    <div key={d.dateStr} className="p-3 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="space-y-1 text-center">
                        <Badge
                          status={rec ? rec.status : 'absent'}
                          size="sm"
                          className="justify-center w-full"
                        />
                        {isPresent && (
                          <div className="text-[11px] text-slate-400 mt-2 space-y-0.5 font-mono">
                            <p>In: {rec.sessions?.[0]?.punch_in ? new Date(rec.sessions[0].punch_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}</p>
                            <p>Out: {rec.sessions?.[rec.sessions.length - 1]?.punch_out ? new Date(rec.sessions[rec.sessions.length - 1].punch_out!).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}</p>
                          </div>
                        )}
                      </div>
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                        <p className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                          {formatDuration(rec?.total_working_seconds || 0)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Weekly summary footer */}
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Total Weekly Working Time
                </span>
                <span className="text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
                  {formatDuration(weeklyTotalSeconds)} ({formatTime(weeklyTotalSeconds)})
                </span>
              </div>
            </div>
          </div>
        ) : (
          <Table
            columns={monthlyColumns}
            data={records}
            loading={loading}
            emptyMessage="No historical timesheet data found."
            rowKey={(r) => r.id}
          />
        )}
      </div>
    </EmployeeLayout>
  );
}
