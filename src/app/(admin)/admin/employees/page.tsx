'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Table, Column } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import {
  UserPlus,
  Search,
  Edit2,
  KeyRound,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Profile } from '@/types';

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Profile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [designation, setDesignation] = useState('Software Engineer');
  const [role, setRole] = useState<'admin' | 'employee'>('employee');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees');
      if (res.ok) {
        const json = await res.json();
        setEmployees(json.employees || []);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setFullName('');
    setEmail('');
    setPassword('');
    // Auto generate next EMP ID
    const count = employees.length + 1;
    setEmployeeId(`EMP${String(count).padStart(3, '0')}`);
    setDepartment('Engineering');
    setDesignation('Software Engineer');
    setRole('employee');
    setJoiningDate(new Date().toISOString().split('T')[0]);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (emp: Profile) => {
    setEditingEmployee(emp);
    setFullName(emp.full_name);
    setEmail(emp.email);
    setPassword('');
    setEmployeeId(emp.employee_id);
    setDepartment(emp.department || 'Engineering');
    setDesignation(emp.designation || 'Staff');
    setRole(emp.role);
    setJoiningDate(emp.joining_date || new Date().toISOString().split('T')[0]);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      if (editingEmployee) {
        // Edit existing
        const res = await fetch(`/api/employees/${editingEmployee.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName,
            department,
            designation,
            role,
            joining_date: joiningDate,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update employee');
        setSuccessMsg('Employee details updated successfully');
      } else {
        // Create new
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName,
            email,
            password: password || 'Welcome@123',
            employee_id: employeeId,
            department,
            designation,
            role,
            joining_date: joiningDate,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create employee');
        setSuccessMsg(`Employee account created for ${fullName}`);
      }

      setModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadEmployees();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error saving employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (emp: Profile) => {
    try {
      const res = await fetch(`/api/employees/${emp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !emp.is_active }),
      });
      if (res.ok) {
        await loadEmployees();
      }
    } catch (err) {
      console.error('Failed to toggle active status:', err);
    }
  };

  const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));

  const filtered = employees.filter((e) => {
    if (departmentFilter !== 'all' && e.department !== departmentFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        e.full_name.toLowerCase().includes(q) ||
        e.employee_id.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const columns: Column<Profile>[] = [
    {
      key: 'name',
      header: 'Employee Name & ID',
      render: (e) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0">
            {e.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{e.full_name}</p>
            <p className="text-xs text-slate-400 font-mono">{e.employee_id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email Address',
      render: (e) => <span className="text-xs text-slate-600 dark:text-slate-300">{e.email}</span>,
    },
    {
      key: 'department',
      header: 'Department & Role',
      render: (e) => (
        <div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{e.department || 'General'}</p>
          <p className="text-[11px] text-slate-400">{e.designation || 'Staff'}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'System Role',
      render: (e) => (
        <span
          className={`text-xs px-2 py-0.5 rounded font-medium ${
            e.role === 'admin'
              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {e.role === 'admin' ? 'Administrator' : 'Employee'}
        </span>
      ),
    },
    {
      key: 'joining_date',
      header: 'Joined Date',
      render: (e) => (
        <span className="text-xs text-slate-500">
          {e.joining_date ? formatDate(e.joining_date) : 'N/A'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => <Badge status={e.is_active ? 'active' : 'inactive'} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (e) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handleOpenEdit(e)}
            title="Edit details"
            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleToggleActive(e)}
            title={e.is_active ? 'Deactivate account' : 'Activate account'}
            className={`p-1.5 rounded-lg ${
              e.is_active
                ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            {e.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Employee Directory & Accounts
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage workforce accounts, assignments, roles, and attendance privileges
            </p>
          </div>

          <Button icon={<UserPlus className="w-4 h-4" />} onClick={handleOpenAdd}>
            Add New Employee
          </Button>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-sm border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {successMsg}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-400">
              {filtered.length} employee{filtered.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ID, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Employees Table */}
        <Table
          columns={columns}
          data={filtered}
          loading={loading}
          emptyMessage="No employees found."
          rowKey={(e) => e.id}
        />

        {/* Add/Edit Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingEmployee ? `Edit Employee: ${editingEmployee.full_name}` : 'Create Employee Account'}
          description={
            editingEmployee
              ? 'Update personal details, department or role designation.'
              : 'Add an employee to the system and configure login credentials.'
          }
        >
          <form onSubmit={handleSave} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2 border border-rose-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
              />
              <Input
                label="Employee ID"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={Boolean(editingEmployee)}
                placeholder="e.g. EMP001"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Email Address"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={Boolean(editingEmployee)}
                placeholder="employee@company.com"
              />
              {!editingEmployee && (
                <Input
                  label="Initial Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Defaults to Welcome@123"
                  hint="Employee can change this on first login"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                options={[
                  { value: 'Engineering', label: 'Engineering' },
                  { value: 'Design', label: 'Design & UI/UX' },
                  { value: 'Marketing', label: 'Marketing' },
                  { value: 'Sales', label: 'Sales & Business Dev' },
                  { value: 'Human Resources', label: 'Human Resources' },
                  { value: 'Operations', label: 'Operations & Support' },
                  { value: 'Finance', label: 'Finance & Accounting' },
                ]}
              />
              <Input
                label="Designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Role Access"
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'employee')}
                options={[
                  { value: 'employee', label: 'Employee (Standard Access)' },
                  { value: 'admin', label: 'Administrator (Full Access)' },
                ]}
              />
              <Input
                label="Joining Date"
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {editingEmployee ? 'Save Changes' : 'Create Account'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
