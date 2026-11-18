'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Table, Column } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { StatsCard } from '@/components/ui/StatsCard';
import { Check, X, Clock, CalendarCheck, CalendarOff, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { LeaveRequest } from '@/types';

export default function AdminLeaveManagementPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadLeaves = useCallback(async () => {
    try {
      const res = await fetch('/api/leave');
      if (res.ok) {
        const json = await res.json();
        setLeaves(json.leaveRequests || []);
      }
    } catch (err) {
      console.error('Failed to load leave requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setActionLoading(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update leave status');
      await loadLeaves();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error updating leave');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingLeaves = leaves.filter((l) => l.status === 'pending');
  const approvedLeaves = leaves.filter((l) => l.status === 'approved');
  const rejectedLeaves = leaves.filter((l) => l.status === 'rejected');

  const displayed = tab === 'pending' ? pendingLeaves : leaves;

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'employee',
      header: 'Employee Name & ID',
      render: (l) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0">
            {l.profiles?.full_name?.charAt(0).toUpperCase() || 'E'}
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{l.profiles?.full_name || 'Employee'}</p>
            <p className="text-xs text-slate-400 font-mono">{l.profiles?.employee_id || ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (l) => <span className="text-xs text-slate-500">{l.profiles?.department || 'General'}</span>,
    },
    {
      key: 'dates',
      header: 'Leave Duration',
      render: (l) => (
        <div>
          <p className="font-medium text-xs text-slate-800 dark:text-slate-200">
            {formatDate(l.start_date)} to {formatDate(l.end_date)}
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            {l.start_date} ~ {l.end_date}
          </p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (l) => (
        <span className="text-xs text-slate-600 dark:text-slate-300 max-w-xs block truncate">
          {l.reason || 'No reason provided'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (l) => <Badge status={l.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (l) => {
        if (l.status !== 'pending') {
          return <span className="text-xs text-slate-400 font-medium">Processed</span>;
        }

        const isBusy = actionLoading === l.id;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => handleUpdateStatus(l.id, 'approved')}
              disabled={isBusy}
              title="Approve leave"
              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleUpdateStatus(l.id, 'rejected')}
              disabled={isBusy}
              title="Reject leave"
              className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Leave Requests & Approvals
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review, approve, or reject employee leave requests. Approved leaves automatically reflect in attendance.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-sm border border-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {errorMsg}
          </div>
        )}

        {/* Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard
            title="Pending Requests"
            value={pendingLeaves.length}
            subtitle="Requires administrator decision"
            icon={<Clock className="w-5 h-5" />}
            color="amber"
          />
          <StatsCard
            title="Approved Leaves"
            value={approvedLeaves.length}
            subtitle="Granted absences"
            icon={<CalendarCheck className="w-5 h-5" />}
            color="emerald"
          />
          <StatsCard
            title="Rejected Requests"
            value={rejectedLeaves.length}
            subtitle="Declined applications"
            icon={<CalendarOff className="w-5 h-5" />}
            color="rose"
          />
        </div>

        {/* Tab switch */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center">
            <button
              onClick={() => setTab('pending')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                tab === 'pending'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Pending ({pendingLeaves.length})
            </button>
            <button
              onClick={() => setTab('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                tab === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Requests ({leaves.length})
            </button>
          </div>
        </div>

        {/* Requests Table */}
        <Table
          columns={columns}
          data={displayed}
          loading={loading}
          emptyMessage={tab === 'pending' ? 'No pending leave requests.' : 'No leave requests recorded.'}
          rowKey={(l) => l.id}
        />
      </div>
    </AdminLayout>
  );
}
