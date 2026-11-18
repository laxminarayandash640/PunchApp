'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, Column } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { StatsCard } from '@/components/ui/StatsCard';
import { Plus, CalendarOff, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { LeaveRequest } from '@/types';

export default function EmployeeLeavePage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form fields
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const loadLeaves = useCallback(async () => {
    try {
      const res = await fetch('/api/leave');
      if (res.ok) {
        const json = await res.json();
        setLeaves(json.leaveRequests || []);
      }
    } catch (err) {
      console.error('Failed to load leaves:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!startDate || !endDate) {
      setErrorMsg('Please select start and end dates');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setErrorMsg('End date cannot be earlier than start date');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit leave application');
      }

      setModalOpen(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      await loadLeaves();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error submitting leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = leaves.filter((l) => l.status === 'pending').length;
  const approvedCount = leaves.filter((l) => l.status === 'approved').length;
  const rejectedCount = leaves.filter((l) => l.status === 'rejected').length;

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'dates',
      header: 'Leave Dates',
      render: (l) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {formatDate(l.start_date)} to {formatDate(l.end_date)}
          </p>
          <p className="text-xs text-slate-400 font-mono">
            {l.start_date} ~ {l.end_date}
          </p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (l) => (
        <span className="text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate block">
          {l.reason || 'No specific reason provided'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (l) => <Badge status={l.status} size="sm" />,
    },
    {
      key: 'applied_on',
      header: 'Applied On',
      render: (l) => (
        <span className="text-xs text-slate-400">
          {new Date(l.created_at).toLocaleDateString('en-IN')}
        </span>
      ),
    },
  ];

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Leave Management
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Apply for leaves and track your approval status in real-time
            </p>
          </div>

          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setErrorMsg(null);
              setModalOpen(true);
            }}
          >
            Apply for Leave
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard
            title="Pending Requests"
            value={pendingCount}
            subtitle="Awaiting admin approval"
            icon={<Clock className="w-5 h-5" />}
            color="amber"
          />
          <StatsCard
            title="Approved Leaves"
            value={approvedCount}
            subtitle="Granted time off"
            icon={<CheckCircle2 className="w-5 h-5" />}
            color="emerald"
          />
          <StatsCard
            title="Total Applications"
            value={leaves.length}
            subtitle={`${rejectedCount} rejected`}
            icon={<CalendarOff className="w-5 h-5" />}
            color="purple"
          />
        </div>

        {/* Leave Requests Table */}
        <Table
          columns={columns}
          data={leaves}
          loading={loading}
          emptyMessage="You haven't submitted any leave requests yet."
          rowKey={(l) => l.id}
        />

        {/* Apply Leave Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Apply for Leave"
          description="Submit your leave application for administrator review."
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                label="End Date"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Reason for Leave
              </label>
              <textarea
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the purpose of your leave (sick leave, family emergency, vacation, etc.)..."
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Submit Request
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </EmployeeLayout>
  );
}
