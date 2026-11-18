'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Clock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

type Strength = 'none' | 'weak' | 'fair' | 'good' | 'strong';

function getPasswordStrength(password: string): Strength {
  if (!password) return 'none';
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return 'weak';
  if (score === 2) return 'fair';
  if (score === 3) return 'good';
  return 'strong';
}

const strengthConfig: Record<Strength, { label: string; color: string; bars: number }> = {
  none:   { label: '',        color: 'bg-gray-200',   bars: 0 },
  weak:   { label: 'Weak',   color: 'bg-red-500',    bars: 1 },
  fair:   { label: 'Fair',   color: 'bg-orange-400', bars: 2 },
  good:   { label: 'Good',   color: 'bg-yellow-400', bars: 3 },
  strong: { label: 'Strong', color: 'bg-emerald-500', bars: 4 },
};

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const strength = getPasswordStrength(password);
  const cfg = strengthConfig[strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (strength === 'weak') {
      setError('Please choose a stronger password.');
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg mb-4">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AttendanceIQ</h1>
          <p className="text-sm text-gray-500 mt-1">Employee Attendance & Timesheet Management</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-white/60 p-8">
          {!success ? (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 mb-4">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Set new password</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Choose a strong password for your account.
                </p>
              </div>

              {error && (
                <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* New password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      className="w-full px-4 py-2.5 pr-11 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Strength meter */}
                  {password && (
                    <div className="mt-2.5">
                      <div className="flex gap-1.5 mb-1">
                        {[1, 2, 3, 4].map((bar) => (
                          <div
                            key={bar}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                              bar <= cfg.bars ? cfg.color : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs font-medium ${
                        strength === 'weak' ? 'text-red-500' :
                        strength === 'fair' ? 'text-orange-500' :
                        strength === 'good' ? 'text-yellow-600' :
                        'text-emerald-600'
                      }`}>
                        {cfg.label}
                        {strength === 'weak' && ' — Add uppercase, numbers & symbols'}
                        {strength === 'fair' && ' — Add more variety'}
                        {strength === 'good' && ' — Almost there!'}
                        {strength === 'strong' && ' — Great password!'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm"
                      type={showConfirm ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      className={`w-full px-4 py-2.5 pr-11 rounded-xl border bg-gray-50 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition ${
                        confirmPassword && confirmPassword !== password
                          ? 'border-red-300 focus:ring-red-400'
                          : 'border-gray-200 focus:ring-emerald-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>

                {/* Password requirements */}
                <ul className="text-xs text-gray-400 space-y-1 pl-1">
                  {[
                    { met: password.length >= 8, text: 'At least 8 characters' },
                    { met: /[A-Z]/.test(password), text: 'One uppercase letter' },
                    { met: /[0-9]/.test(password), text: 'One number' },
                    { met: /[^A-Za-z0-9]/.test(password), text: 'One special character' },
                  ].map((req) => (
                    <li key={req.text} className={`flex items-center gap-1.5 ${req.met ? 'text-emerald-600' : 'text-gray-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full inline-block ${req.met ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      {req.text}
                    </li>
                  ))}
                </ul>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-sm shadow-md hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Password updated!</h2>
              <p className="text-sm text-gray-500 mb-6">
                Your password has been changed successfully. Redirecting you to login…
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-sm shadow hover:from-emerald-600 hover:to-teal-700 transition"
              >
                Go to login
              </Link>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} AttendanceIQ. All rights reserved.
        </p>
      </div>
    </div>
  );
}
