'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Table, Column } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Download, Printer, Search, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, formatTime, formatDuration } from '@/lib/utils';
import type { AttendanceWithSessions, Profile } from '@/types';

export default function AdminTimesheetPage() {
  const [tab, setTab] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [records, setRecords] = useState<AttendanceWithSessions[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedEmp, setSelectedEmp] = useState('all');
  const [search, setSearch] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        const [empRes, attRes] = await Promise.all([
          fetch('/api/employees'),
          fetch('/api/admin/attendance?limit=500'),
        ]);

        if (empRes.ok) {
          const empJson = await empRes.json();
          setEmployees(empJson.employees || []);
        }
        if (attRes.ok) {
          const attJson = await attRes.json();
          setRecords(attJson.records || []);
        }
      } catch (err) {
        console.error('Failed to load timesheet data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));

  // Calculate current 7 days for weekly view
  const weekDays = useMemo(() => {
    const curr = new Date();
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7;
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
  }, [weekOffset]);

  // Lookup map: `${employee_id}_${attendance_date}` -> record
  const empDateMap = useMemo(() => {
    const map = new Map<string, AttendanceWithSessions>();
    records.forEach((r) => {
      map.set(`${r.employee_id}_${r.attendance_date}`, r);
    });
    return map;
  }, [records]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (selectedDept !== 'all' && e.department !== selectedDept) return false;
      if (selectedEmp !== 'all' && e.id !== selectedEmp) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.full_name.toLowerCase().includes(q) ||
          e.employee_id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [employees, selectedDept, selectedEmp, search]);

  // Export Timesheet CSV
  const handleExportCSV = () => {
    if (tab === 'weekly') {
      const headers = ['Employee Name', 'Employee ID', 'Department', ...weekDays.map((d) => `${d.dayName} (${d.label})`), 'Total Weekly Hours', 'Days Present'];
      const rows = filteredEmployees.map((emp) => {
        let totalSecs = 0;
        let daysPresent = 0;
        const dayHours = weekDays.map((d) => {
          const rec = empDateMap.get(`${emp.id}_${d.dateStr}`);
          if (rec) {
            totalSecs += rec.total_working_seconds || 0;
            if (rec.status === 'present') daysPresent++;
            return formatDuration(rec.total_working_seconds || 0);
          }
          return '00:00:00';
        });

        return [
          `"${emp.full_name}"`,
          emp.employee_id,
          `"${emp.department || ''}"`,
          ...dayHours,
          formatDuration(totalSecs),
          daysPresent,
        ];
      });

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `weekly_timesheet_${weekDays[0].dateStr}_to_${weekDays[6].dateStr}.csv`;
      link.click();
    } else {
      window.print();
    }
  };

  // Daily View Columns
  const dailyColumns: Column<AttendanceWithSessions>[] = [
    {
      key: 'employee',
      header: 'Employee Name & ID',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{r.profile?.full_name || 'Employee'}</p>
          <p className="text-xs text-slate-400 font-mono">{r.profile?.employee_id || ''}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (r) => <span className="text-xs">{formatDate(r.attendance_date)}</span>,
    },
    {
      key: 'in',
      header: 'First In',
      render: (r) => (
        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
          {r.sessions?.[0]?.punch_in
            ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }).format(new Date(r.sessions[0].punch_in))
            : '--:--'}
        </span>
      ),
    },
    {
      key: 'out',
      header: 'Last Out',
      render: (r) => (
        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
          {r.sessions?.[r.sessions.length - 1]?.punch_out
            ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }).format(new Date(r.sessions[r.sessions.length - 1].punch_out!))
            : '--:--'}
        </span>
      ),
    },
    {
      key: 'hours',
      header: 'Total Working Hours',
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
          {formatDuration(r.total_working_seconds)} ({formatTime(r.total_working_seconds)})
        </span>
      ),
    },
    {
      key: 'sessions',
      header: 'Sessions',
      render: (r) => <span className="text-xs">{r.sessions?.length || 0} session(s)</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge status={r.status} size="sm" />,
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Workforce Timesheets
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Daily, weekly, and monthly aggregate working hours across all departments
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Printer className="w-3.5 h-3.5" />}
              onClick={() => window.print()}
            >
              Print
            </Button>
            <Button
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleExportCSV}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* View Switcher Tabs & Filters */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center">
              <button
                onClick={() => setTab('daily')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  tab === 'daily'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Daily Timesheet
              </button>
              <button
                onClick={() => setTab('weekly')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  tab === 'weekly'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Weekly Matrix
              </button>
              <button
                onClick={() => setTab('monthly')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  tab === 'monthly'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Monthly Summary
              </button>
            </div>

            {tab === 'weekly' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWeekOffset((p) => p - 1)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold px-2">
                  {weekDays[0].label} – {weekDays[6].label}
                </span>
                <button
                  onClick={() => setWeekOffset((p) => p + 1)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full sm:w-auto px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={selectedEmp}
              onChange={(e) => setSelectedEmp(e.target.value)}
              className="w-full sm:w-auto px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name} ({e.employee_id})
                </option>
              ))}
            </select>

            <div className="relative w-full sm:w-64 sm:ml-auto">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Tab 1: Weekly Matrix */}
        {tab === 'weekly' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                  <th className="px-4 py-3 font-semibold uppercase text-slate-500">Employee</th>
                  <th className="px-3 py-3 font-semibold uppercase text-slate-500">Dept</th>
                  {weekDays.map((d) => (
                    <th key={d.dateStr} className="px-3 py-3 font-semibold uppercase text-slate-500 text-center">
                      <div>{d.dayName}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{d.label}</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold uppercase text-slate-500 text-right">Weekly Total</th>
                  <th className="px-3 py-3 font-semibold uppercase text-slate-500 text-center">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredEmployees.map((emp) => {
                  let totalSecs = 0;
                  let presentCount = 0;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <div>{emp.full_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{emp.employee_id}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-500">{emp.department || 'General'}</td>
                      {weekDays.map((d) => {
                        const rec = empDateMap.get(`${emp.id}_${d.dateStr}`);
                        if (rec) {
                          totalSecs += rec.total_working_seconds || 0;
                          if (rec.status === 'present') presentCount++;
                        }
                        return (
                          <td key={d.dateStr} className="px-3 py-3 text-center font-mono">
                            {rec ? (
                              <div>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {formatDuration(rec.total_working_seconds || 0)}
                                </span>
                                <div className="text-[10px]">
                                  <Badge status={rec.status} size="sm" />
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">--:--</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatDuration(totalSecs)}
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {presentCount}/7
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Daily Timesheet */}
        {tab === 'daily' && (
          <Table
            columns={dailyColumns}
            data={records}
            loading={loading}
            emptyMessage="No daily records found."
            rowKey={(r) => r.id}
          />
        )}

        {/* Tab 3: Monthly Summary */}
        {tab === 'monthly' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                  <th className="px-4 py-3 font-semibold uppercase text-slate-500">Employee</th>
                  <th className="px-3 py-3 font-semibold uppercase text-slate-500">Department</th>
                  <th className="px-3 py-3 font-semibold uppercase text-slate-500 text-center">Total Days</th>
                  <th className="px-3 py-3 font-semibold uppercase text-slate-500 text-center">Present Days</th>
                  <th className="px-3 py-3 font-semibold uppercase text-slate-500 text-center">Absent Days</th>
                  <th className="px-4 py-3 font-semibold uppercase text-slate-500 text-right">Total Hours</th>
                  <th className="px-4 py-3 font-semibold uppercase text-slate-500 text-right">Avg Daily Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredEmployees.map((emp) => {
                  const empRecords = records.filter((r) => r.employee_id === emp.id);
                  const presentCount = empRecords.filter((r) => r.status === 'present').length;
                  const absentCount = empRecords.filter((r) => r.status === 'absent').length;
                  const totalSecs = empRecords.reduce((acc, r) => acc + (r.total_working_seconds || 0), 0);
                  const avgDailySecs = presentCount > 0 ? Math.round(totalSecs / presentCount) : 0;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <div>{emp.full_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{emp.employee_id}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-500">{emp.department || 'General'}</td>
                      <td className="px-3 py-3 text-center">{empRecords.length}</td>
                      <td className="px-3 py-3 text-center font-semibold text-emerald-600">{presentCount}</td>
                      <td className="px-3 py-3 text-center font-semibold text-rose-600">{absentCount}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatDuration(totalSecs)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatTime(avgDailySecs)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
