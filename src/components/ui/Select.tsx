import React from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: { value: string; label: string }[];
  hint?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, children, className, id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={cn(
            'w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border rounded-lg transition-colors',
            'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
            'disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500',
            error && 'border-rose-500 focus:ring-rose-500',
            className
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
