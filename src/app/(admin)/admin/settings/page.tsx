'use client';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Building2, Clock, Globe, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import type { CompanySettings } from '@/types';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form fields
  const [companyName, setCompanyName] = useState('AttendTrack Technologies');
  const [workStartTime, setWorkStartTime] = useState('00:05:00');
  const [workEndTime, setWorkEndTime] = useState('23:59:00');
  const [expectedHours, setExpectedHours] = useState(8);
  const [gracePeriod, setGracePeriod] = useState(15);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [allowMultiple, setAllowMultiple] = useState(true);
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const json = await res.json();
          if (json.settings) {
            const s: CompanySettings = json.settings;
            setSettings(s);
            setCompanyName(s.company_name || 'AttendTrack Technologies');
            setWorkStartTime(s.work_start_time || '00:05:00');
            setWorkEndTime(s.work_end_time || '23:59:00');
            setExpectedHours(s.expected_working_hours || 8);
            setGracePeriod(s.grace_period_minutes || 15);
            setTimezone(s.timezone || 'Asia/Kolkata');
            setAllowMultiple(s.allow_multiple_sessions ?? true);
            if (s.working_days) setWorkingDays(s.working_days);
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleToggleDay = (dayIndex: number) => {
    setWorkingDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          work_start_time: workStartTime,
          work_end_time: workEndTime,
          expected_working_hours: Number(expectedHours),
          grace_period_minutes: Number(gracePeriod),
          timezone,
          allow_multiple_sessions: allowMultiple,
          working_days: workingDays,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      setSuccessMsg('Attendance settings and organization rules saved successfully.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error updating settings');
    } finally {
      setSaving(false);
    }
  };

  const daysLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Attendance Rules & Settings
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure official work schedules, shift timings, grace periods, and calculation policies
          </p>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-sm border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-sm border border-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Profile Section */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" /> Organization Profile
              </h3>
              <p className="text-xs text-slate-400">Company identity displayed across dashboards and timesheets</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Company Name"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
              <Select
                label="Primary Timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                options={[
                  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST +05:30)' },
                  { value: 'UTC', label: 'UTC (Universal Coordinated Time)' },
                  { value: 'America/New_York', label: 'America/New_York (EST)' },
                  { value: 'Europe/London', label: 'Europe/London (GMT)' },
                  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
                  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
                ]}
              />
            </div>
          </div>

          {/* Shift Timings & Calculation Rules */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" /> Work Hours & Grace Period
              </h3>
              <p className="text-xs text-slate-400">Timestamps for punctuality evaluation and shift compliance</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Shift Start Time (HH:MM)"
                type="time"
                step="1"
                required
                value={workStartTime}
                onChange={(e) => setWorkStartTime(e.target.value)}
              />
              <Input
                label="Shift End Time (HH:MM)"
                type="time"
                step="1"
                required
                value={workEndTime}
                onChange={(e) => setWorkEndTime(e.target.value)}
              />
              <Input
                label="Expected Daily Working Hours"
                type="number"
                min="1"
                max="16"
                step="0.5"
                required
                value={expectedHours}
                onChange={(e) => setExpectedHours(Number(e.target.value))}
                hint="Used for daily timesheet target calculations"
              />
              <Input
                label="Late Arrival Grace Period (Minutes)"
                type="number"
                min="0"
                max="120"
                required
                value={gracePeriod}
                onChange={(e) => setGracePeriod(Number(e.target.value))}
                hint="Allowances before marking check-in as late"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowMultiple}
                  onChange={(e) => setAllowMultiple(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Allow Multiple Punch Sessions per Day
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Employees can punch in and out multiple times (e.g. lunch breaks, client meetings) and durations will accumulate.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Official Working Days */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600" /> Official Working Days
              </h3>
              <p className="text-xs text-slate-400">Unchecked days will be considered official weekend holidays</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {daysLabels.map((dayName, idx) => {
                const isSelected = workingDays.includes(idx);
                return (
                  <button
                    type="button"
                    key={dayName}
                    onClick={() => handleToggleDay(idx)}
                    className={`p-3 rounded-xl border text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {dayName.slice(0, 3)}
                    <span className="block text-[10px] font-normal mt-0.5 opacity-80">
                      {isSelected ? 'Working' : 'Holiday'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="submit" loading={saving} size="lg">
              Save Settings & Policies
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
