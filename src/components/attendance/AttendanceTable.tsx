'use client';

import React, { useState, useMemo } from 'react';
import { Download, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Table, Column } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatDate, formatTime, formatDuration } from '@/lib/utils';
import type { AttendanceWithSessions } from '@/types';

interface AttendanceTableProps {
  records: AttendanceWithSessions[];
  loading?: boolean;
}

export function AttendanceTable({ records, loading = false }: AttendanceTableProps) {
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceWithSessions | null>(null);

  const pageSize = 10;

  // Filter records
  const filtered = useMemo(() => {
    let result = [...records];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.attendance_date.includes(q) ||
          r.status.toLowerCase().includes(q) ||
          r.profile?.full_name?.toLowerCase().includes(q) ||
          r.profile?.employee_id?.toLowerCase().includes(q)
      );
    }

    const todayStr = new Date().toISOString().split('T')[0];

    if (filterPeriod === 'today') {
      result = result.filter((r) => r.attendance_date === todayStr);
    } else if (filterPeriod === 'week') {
      const now = new Date();
      const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      const weekStartStr = firstDayOfWeek.toISOString().split('T')[0];
      result = result.filter((r) => r.attendance_date >= weekStartStr);
    } else if (filterPeriod === 'month') {
      const monthStartStr = new Date().toISOString().slice(0, 7) + '-01';
      result = result.filter((r) => r.attendance_date >= monthStartStr);
    } else if (filterPeriod === 'custom' && startDate && endDate) {
      result = result.filter(
        (r) => r.attendance_date >= startDate && r.attendance_date <= endDate
      );
    }

    return result.sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
  }, [records, search, filterPeriod, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Date', 'Status', 'First Punch In', 'Last Punch Out', 'Total Working Hours', 'Sessions Count'];
    const rows = filtered.map((r) => {
      const firstIn = r.sessions?.[0]?.punch_in ? new Date(r.sessions[0].punch_in).toLocaleTimeString('en-IN') : '--';
      const lastOut = r.sessions?.[r.sessions.length - 1]?.punch_out
        ? new Date(r.sessions[r.sessions.length - 1].punch_out!).toLocaleTimeString('en-IN')
        : '--';
      return [
        r.attendance_date,
        r.status,
        firstIn,
        lastOut,
        formatDuration(r.total_working_seconds),
        r.sessions?.length || 0,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_records_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: Column<AttendanceWithSessions>[] = [
    {
      key: 'attendance_date',
      header: 'Date',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{formatDate(r.attendance_date)}</p>
          <p className="text-xs text-slate-400 font-mono">{r.attendance_date}</p>
        </div>
      ),
    },
    {
      key: 'punch_in',
      header: 'First Punch In',
      render: (r) => {
        const first = r.sessions?.[0]?.punch_in;
        return (
          <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
            {first
              ? new Intl.DateTimeFormat('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                }).format(new Date(first))
              : '--:--'}
          </span>
        );
      },
    },
    {
      key: 'punch_out',
      header: 'Last Punch Out',
      render: (r) => {
        const last = r.sessions?.[r.sessions.length - 1]?.punch_out;
        return (
          <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
            {last
              ? new Intl.DateTimeFormat('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                }).format(new Date(last))
              : '--:--'}
          </span>
        );
      },
    },
    {
      key: 'total_working_seconds',
      header: 'Total Working Hours',
      render: (r) => (
        <div>
          <span className="font-mono font-semibold text-sm text-slate-900 dark:text-slate-100">
            {formatDuration(r.total_working_seconds)}
          </span>
          <span className="text-xs text-slate-400 ml-1.5 font-sans">
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
      key: 'sessions',
      header: 'Sessions',
      render: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {r.sessions?.length || 0} session{r.sessions?.length === 1 ? '' : 's'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Details',
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
    <div className="space-y-4">
      {/* Filters and search header */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setFilterPeriod('all'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterPeriod === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setFilterPeriod('today'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterPeriod === 'today'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => { setFilterPeriod('week'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterPeriod === 'week'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => { setFilterPeriod('month'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterPeriod === 'month'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => { setFilterPeriod('custom'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterPeriod === 'custom'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            Custom Range
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filterPeriod === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              />
            </div>
          )}

          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <Table
        columns={columns}
        data={paginated}
        loading={loading}
        emptyMessage="No attendance records found for this period."
        rowKey={(r) => r.id}
      />

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} records
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Session Details Modal */}
      <Modal
        isOpen={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
        title={`Attendance Sessions: ${selectedRecord?.attendance_date ? formatDate(selectedRecord.attendance_date) : ''}`}
        description="Detailed log of all punch in and punch out sessions for this day."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div>
              <p className="text-xs text-slate-500">Day Status</p>
              <Badge status={selectedRecord?.status || 'absent'} size="sm" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Hours</p>
              <p className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                {formatDuration(selectedRecord?.total_working_seconds || 0)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Punch Sessions ({selectedRecord?.sessions?.length || 0})
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
                          Out: {s.punch_out ? new Date(s.punch_out).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Active Session'}
                        </p>
                      </div>
                    </div>
                    <div className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {s.duration_seconds ? formatTime(s.duration_seconds) : 'Running'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No individual session records recorded.</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
