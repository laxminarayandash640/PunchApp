'use client';

import React, { useState } from 'react';
import { EmployeeLayout } from '@/components/layout/EmployeeLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { User, Mail, Building, Briefcase, Calendar, Shield, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';

export default function EmployeeProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const supabase = createClient();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password update states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);
    setProfileSaving(true);

    try {
      if (!profile?.id) throw new Error('User profile not found');

      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <EmployeeLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            My Profile
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage your account credentials and personal details
          </p>
        </div>

        {/* Profile Card Header */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white font-extrabold text-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="text-center sm:text-left space-y-2 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {profile?.full_name || 'Employee Name'}
                </h2>
                <Badge status={profile?.is_active ? 'active' : 'inactive'} size="sm" />
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-2.5 py-0.5 rounded-full font-medium">
                  {profile?.role === 'admin' ? 'Administrator' : 'Standard Employee'}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5 font-mono">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  ID: {profile?.employee_id || 'EMP000'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  {profile?.email || 'email@example.com'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-purple-600" />
                  {profile?.department || 'Department'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                  {profile?.designation || 'Designation'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-600" />
                  Joined: {profile?.joining_date ? formatDate(profile.joining_date) : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Details Form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" /> Personal Information
            </h3>
            <p className="text-xs text-slate-400">
              Only authorized administrators can modify employee ID, department, or role.
            </p>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            {profileSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-xs flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" /> Profile updated successfully.
              </div>
            )}
            {profileError && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2 border border-rose-200">
                <AlertCircle className="w-4 h-4" /> {profileError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <Input
                label="Email Address"
                value={profile?.email || ''}
                disabled
                hint="Managed via authentication provider"
              />
              <Input
                label="Employee ID"
                value={profile?.employee_id || ''}
                disabled
                hint="Assigned by administrator"
              />
              <Input
                label="Department"
                value={profile?.department || ''}
                disabled
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={profileSaving}>
                Save Changes
              </Button>
            </div>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" /> Change Password
            </h3>
            <p className="text-xs text-slate-400">
              Update your account password for enhanced security.
            </p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {passwordSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-xs flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" /> Password changed successfully.
              </div>
            )}
            {passwordError && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2 border border-rose-200">
                <AlertCircle className="w-4 h-4" /> {passwordError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="New Password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
              <Input
                label="Confirm Password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={passwordSaving}>
                Update Password
              </Button>
            </div>
          </form>
        </div>
      </div>
    </EmployeeLayout>
  );
}
