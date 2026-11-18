'use client';

import React, { useState, useEffect } from 'react';
import { LogIn, LogOut, Clock, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatTime, formatDuration } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type { AttendanceWithSessions } from '@/types';

interface PunchCardProps {
  attendance: AttendanceWithSessions | null;
  onPunchIn: () => Promise<void>;
  onPunchOut: () => Promise<void>;
  loading?: boolean;
}

export function PunchCard({ attendance, onPunchIn, onPunchOut, loading = false }: PunchCardProps) {
  const [liveClock, setLiveClock] = useState('');
  const [currentDateFormatted, setCurrentDateFormatted] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Check active session (punch_out is null)
  const activeSession = attendance?.sessions?.find((s) => !s.punch_out);
  const isPunchedIn = Boolean(activeSession);
  const lastSession = attendance?.sessions && attendance.sessions.length > 0
    ? attendance.sessions[attendance.sessions.length - 1]
    : null;

  // Format punch times
  const formatTimeStr = (iso: string | null | undefined) => {
    if (!iso) return '--:--';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  };

  // Clock updates every second
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setLiveClock(
        new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(now)
      );
      setCurrentDateFormatted(
        new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(now)
      );

      // Calculate running session seconds if punched in
      if (activeSession && activeSession.punch_in) {
        const inMs = new Date(activeSession.punch_in).getTime();
        const diffSecs = Math.max(0, Math.floor((now.getTime() - inMs) / 1000));
        setSessionSeconds(diffSecs);
      } else {
        setSessionSeconds(0);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const totalSecondsCompleted = attendance?.total_working_seconds || 0;
  const currentTotalSeconds = isPunchedIn
    ? totalSecondsCompleted + sessionSeconds
    : totalSecondsCompleted;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
        {/* Time and Date header */}
        <div className="text-center md:text-left space-y-1">
          <div className="flex items-center justify-center md:justify-start gap-2 text-slate-500 dark:text-slate-400 text-sm">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>{currentDateFormatted || 'Loading current date...'}</span>
          </div>
          <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
            {liveClock || '--:--:--'}
          </div>
          <p className="text-xs text-slate-400 font-medium">Standard Time: Asia/Kolkata (IST)</p>
        </div>

        {/* Current status indicator */}
        <div className="flex flex-col items-center md:items-end gap-2">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Today&apos;s Status</div>
          <Badge
            status={isPunchedIn ? 'working' : attendance ? attendance.status : 'absent'}
            size="md"
          />
          {isPunchedIn && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-pulse flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Session active: {formatDuration(sessionSeconds)}
            </span>
          )}
        </div>
      </div>

      {/* Main Punch Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-8">
        {/* PUNCH IN BUTTON */}
        <button
          onClick={onPunchIn}
          disabled={loading || isPunchedIn}
          className={`relative group overflow-hidden rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 font-bold ${
            isPunchedIn
              ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-60'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 active:scale-[0.98]'
          }`}
        >
          <div className={`p-4 rounded-full ${isPunchedIn ? 'bg-slate-200 dark:bg-slate-700' : 'bg-white/20'}`}>
            <LogIn className="w-8 h-8" />
          </div>
          <span className="text-lg tracking-wide uppercase">PUNCH IN</span>
          <span className="text-xs font-normal text-emerald-100">
            {isPunchedIn ? 'Already punched in' : 'Click to start work session'}
          </span>
        </button>

        {/* PUNCH OUT BUTTON */}
        <button
          onClick={onPunchOut}
          disabled={loading || !isPunchedIn}
          className={`relative group overflow-hidden rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 font-bold ${
            !isPunchedIn
              ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-60'
              : 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 active:scale-[0.98]'
          }`}
        >
          <div className={`p-4 rounded-full ${!isPunchedIn ? 'bg-slate-200 dark:bg-slate-700' : 'bg-white/20'}`}>
            <LogOut className="w-8 h-8" />
          </div>
          <span className="text-lg tracking-wide uppercase">PUNCH OUT</span>
          <span className="text-xs font-normal text-rose-100">
            {!isPunchedIn ? 'Punch in first' : 'Click to end work session'}
          </span>
        </button>
      </div>

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 -mx-6 -mb-6 p-6 rounded-b-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">First Punch-In</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {attendance?.sessions?.[0] ? formatTimeStr(attendance.sessions[0].punch_in) : '--:--'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Last Punch-Out</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {lastSession?.punch_out ? formatTimeStr(lastSession.punch_out) : '--:--'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Working Hours Today</p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
              {formatDuration(currentTotalSeconds)}
              <span className="text-xs text-slate-400 font-sans ml-1">
                ({formatTime(currentTotalSeconds)})
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
