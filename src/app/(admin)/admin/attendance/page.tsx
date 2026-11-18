'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Table, Column } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Download, Search, Eye, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, formatTime, formatDuration } from '@/lib/utils';
import type { AttendanceWithSessions, Profile } from '@/types';

export default function AdminAttendanceRecordsPage() {
  const [records, setRecords] = useState<AttendanceWithSessions[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceWithSessions | null>(null);

  const pageSize = 15;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, attRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/admin/attendance?limit=300'),
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
      console.error('Failed to load admin attendance records:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (selectedEmployeeId !== 'all' && r.employee_id !== selectedEmployeeId) return false;
      if (selectedDepartment !== 'all' && r.profile?.department !== selectedDepartment) return false;
      if (selectedStatus !== 'all' && r.status !== selectedStatus) return false;
      if (startDate && r.attendance_date < startDate) return false;
      if (endDate && r.attendance_date > endDate) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.profile?.full_name?.toLowerCase().includes(q) ||
          r.profile?.employee_id?.toLowerCase().includes(q) ||
          r.attendance_date.includes(q)
        );
      }
      return true;
    });
  }, [records, selectedEmployeeId, selectedDepartment, selectedStatus, startDate, endDate, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportCSV = () => {
    const headers = ['Employee Name', 'Employee ID', 'Department', 'Date', 'First Punch In', 'Last Punch Out', 'Total Hours', 'Sessions Count', 'Status'];
    const rows = filtered.map((r) => {
      const firstIn = r.sessions?.[0]?.punch_in ? new Date(r.sessions[0].punch_in).toLocaleTimeString('en-IN') : '--';
      const lastOut = r.sessions?.[r.sessions.length - 1]?.punch_out
        ? new Date(r.sessions[r.sessions.length - 1].punch_out!).toLocaleTimeString('en-IN')
        : '--';
      return [
        `"${r.profile?.full_name || ''}"`,
        r.profile?.employee_id || '',
        `"${r.profile?.department || ''}"`,
        r.attendance_date,
        firstIn,
        lastOut,
        formatDuration(r.total_working_seconds),
        r.sessions?.length || 0,
        r.status,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_master_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const columns: Column<AttendanceWithSessions>[] = [
    {
      key: 'employee',
      header: 'Employee Name & ID',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0">
            {r.profile?.full_name?.charAt(0).toUpperCase() || 'E'}
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{r.profile?.full_name || 'Employee'}</p>
            <p className="text-xs text-slate-400 font-mono">{r.profile?.employee_id || 'ID'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (r) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {r.profile?.department || 'General'}
        </span>
      ),
    },
    {
      key: 'attendance_date',
      header: 'Date',
      render: (r) => (
        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
          {formatDate(r.attendance_date)}
        </span>
      ),
    },
    {
      key: 'punch_in',
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
      key: 'punch_out',
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
      key: 'working_hours',
      header: 'Duration',
      render: (r) => (
        <div className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
          {formatDuration(r.total_working_seconds)}
          <span className="text-[10px] text-slate-400 font-sans ml-1">
            ({formatTime(r.total_working_seconds)})
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge status={r.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Log',
      align: 'right',
      render: (r) => (
        <Button
          size="sm"
          variant="ghost"
          icon={<Eye className="w-3.5 h-3.5" />}
          onClick={() => setSelectedRecord(r)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Master Attendance Records
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Comprehensive historical repository of all employee punch logs and timesheet data
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={handleExportCSV}
          >
            Export All (CSV)
          </Button>
        </div>

        {/* Filter bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <select
              value={selectedEmployeeId}
              onChange={(e) => { setSelectedEmployeeId(e.target.value); setCurrentPage(1); }}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name} ({e.employee_id})
                </option>
              ))}
            </select>

            <select
              value={selectedDepartment}
              onChange={(e) => { setSelectedDepartment(e.target.value); setCurrentPage(1); }}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="leave">On Leave</option>
            </select>

            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              placeholder="From Date"
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              placeholder="To Date"
            />
          </div>

          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee name, ID or date..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Master Table */}
        <Table
          columns={columns}
          data={paginated}
          loading={loading}
          emptyMessage="No attendance records match the selected filters."
          rowKey={(r) => r.id}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} records
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Modal for session breakdown */}
        <Modal
          isOpen={Boolean(selectedRecord)}
          onClose={() => setSelectedRecord(null)}
          title={`Sessions Log: ${selectedRecord?.profile?.full_name || 'Employee'}`}
          description={`Date: ${selectedRecord?.attendance_date ? formatDate(selectedRecord.attendance_date) : ''} • ID: ${selectedRecord?.profile?.employee_id || ''}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <div>
                <p className="text-xs text-slate-500">Day Status</p>
                <Badge status={selectedRecord?.status || 'absent'} size="sm" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Working Duration</p>
                <p className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                  {formatDuration(selectedRecord?.total_working_seconds || 0)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Work Sessions ({selectedRecord?.sessions?.length || 0})
              </h4>
              {selectedRecord?.sessions && selectedRecord.sessions.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  {selectedRecord.sessions.map((s, idx) => (
                    <div key={s.id || idx} className="p-3 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            In: {new Date(s.punch_in).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </p>
                          <p className="text-slate-400">
                            Out: {s.punch_out ? new Date(s.punch_out).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Running Session'}
                          </p>
                        </div>
                      </div>
                      <div className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {s.duration_seconds ? formatTime(s.duration_seconds) : 'Active'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">No individual session records found.</p>
              )}
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
