import React from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'emerald' | 'blue' | 'rose' | 'amber' | 'purple' | 'indigo';
  trend?: {
    value: number;
    label: string;
  };
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  color = 'emerald',
  trend,
}: StatsCardProps) {
  const colorStyles = {
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-l-emerald-500',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-l-blue-500',
    },
    rose: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'border-l-rose-500',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-l-amber-500',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'border-l-purple-500',
    },
    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      text: 'text-indigo-600 dark:text-indigo-400',
      border: 'border-l-indigo-500',
    },
  };

  const style = colorStyles[color] || colorStyles.emerald;

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-800 border-l-4 transition-all duration-200 hover:shadow-md',
        style.border
      )}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {title}
          </p>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
          {trend && (
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <span className={trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {trend.value >= 0 ? `+${trend.value}%` : `${trend.value}%`}
              </span>
              <span>{trend.label}</span>
            </p>
          )}
        </div>
        <div className={cn('p-3 rounded-xl flex items-center justify-center shrink-0', style.bg, style.text)}>
          {icon}
        </div>
      </div>
    </div>
  );
}
