'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarCheck,
  Clock,
  CalendarOff,
  User,
  LogOut,
  Building2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface EmployeeSidebarProps {
  onCloseMobile?: () => void;
}

export function EmployeeSidebar({ onCloseMobile }: EmployeeSidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Attendance', href: '/attendance', icon: CalendarCheck },
    { label: 'My Timesheet', href: '/timesheet', icon: Clock },
    { label: 'Leave Management', href: '/leave', icon: CalendarOff },
    { label: 'My Profile', href: '/profile', icon: User },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col h-full border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-5 flex items-center justify-between border-b border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base text-white tracking-tight">AttendTrack</h1>
            <p className="text-[11px] text-slate-400 font-medium">Employee Portal</p>
          </div>
        </Link>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Menu
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-white' : 'text-slate-400')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* User Info & Logout Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-emerald-700/60 text-emerald-200 border border-emerald-500/30 flex items-center justify-center font-bold text-sm shrink-0">
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'E'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">
                {profile?.full_name || 'Employee User'}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {profile?.employee_id || 'EMP'} • {profile?.department || 'Staff'}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
