'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Clock, ArrowLeft, Loader2, AlertCircle, CheckCircle2, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/update-password`
        : `${process.env.NEXT_PUBLIC_SITE_URL}/update-password`;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
    } else {
      setSuccess(true);
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
                  <Mail className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Reset your password</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Enter your registered email and we'll send you a reset link.
                </p>
              </div>

              {error && (
                <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-sm shadow-md hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your inbox</h2>
              <p className="text-sm text-gray-500 mb-1">
                We've sent a password reset link to
              </p>
              <p className="text-sm font-semibold text-gray-800 mb-6">{email}</p>
              <p className="text-xs text-gray-400 mb-6">
                Didn't receive the email? Check your spam folder or{' '}
                <button
                  onClick={() => { setSuccess(false); setEmail(''); }}
                  className="text-emerald-600 font-medium hover:underline"
                >
                  try again
                </button>
                .
              </p>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-gray-100">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-emerald-600 font-medium transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} AttendanceIQ. All rights reserved.
        </p>
      </div>
    </div>
  );
}
