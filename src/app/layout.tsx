import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';

// ----------------------------------------------------------------
// Font
// ----------------------------------------------------------------
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700', '800'],
});

// ----------------------------------------------------------------
// Metadata
// ----------------------------------------------------------------
export const metadata: Metadata = {
  title: {
    default: 'AttendTrack - Employee Attendance System',
    template: '%s | AttendTrack',
  },
  description:
    'AttendTrack is a modern employee attendance and timesheet management system. ' +
    'Track punch-ins, punch-outs, leave requests, and generate detailed reports — all in one place.',
  keywords: [
    'attendance management',
    'employee timesheet',
    'HR software',
    'punch in punch out',
    'leave management',
    'workforce management',
  ],
  authors: [{ name: 'AttendTrack' }],
  creator: 'AttendTrack',
  robots: {
    index: false, // Internal HR tool — not for public indexing.
    follow: false,
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9fafb' },
    { media: '(prefers-color-scheme: dark)',  color: '#0f172a' },
  ],
};

// ----------------------------------------------------------------
// Root Layout
// ----------------------------------------------------------------
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={inter.variable}
    >
      {/*
        suppressHydrationWarning on <html> is intentional:
        ThemeProvider adds the 'dark' class client-side based on
        localStorage, causing an expected mismatch on the first paint.
      */}
      <body
        className={`
          ${inter.className}
          antialiased
          bg-gray-50 dark:bg-gray-900
          text-gray-900 dark:text-gray-100
          min-h-screen
        `}
      >
        {/* ThemeProvider must wrap AuthProvider so contexts are available everywhere */}
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
