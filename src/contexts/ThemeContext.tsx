'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// ----------------------------------------------------------------
// Context
// ----------------------------------------------------------------
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ----------------------------------------------------------------
// Storage key
// ----------------------------------------------------------------
const STORAGE_KEY = 'attendtrack-theme';

// ----------------------------------------------------------------
// Helper — apply the theme class to <html>
// ----------------------------------------------------------------
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  // Sync with native colour-scheme so browser UI (scrollbars, inputs) adapts.
  root.style.colorScheme = theme;
}

// ----------------------------------------------------------------
// Helper — resolve initial theme (runs once, before paint)
// ----------------------------------------------------------------
function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'; // SSR default

  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // localStorage may be blocked (private browsing, security policy).
  }

  // Fall back to OS preference.
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

// ----------------------------------------------------------------
// ThemeProvider
// ----------------------------------------------------------------
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  // Resolve and apply theme after mount (avoids SSR mismatch).
  useEffect(() => {
    const initial = resolveInitialTheme();
    setThemeState(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  // Listen for OS preference changes.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    function handleChange(e: MediaQueryListEvent) {
      // Only follow OS changes if the user has not stored an explicit preference.
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          const next: Theme = e.matches ? 'dark' : 'light';
          setThemeState(next);
          applyTheme(next);
        }
      } catch {
        // localStorage blocked.
      }
    }

    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage blocked.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage blocked.
      }
      return next;
    });
  }, []);

  // Prevent flash of wrong theme — render children only after mount.
  // We still render the children wrapped in a hidden shell to avoid
  // layout shifts; the actual visible state relies on CSS class toggling.
  if (!mounted) {
    // Return a non-visible wrapper so SSR HTML is emitted but invisible
    // until the client reconciles the correct theme class.
    return (
      <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
        <div style={{ visibility: 'hidden' }}>{children}</div>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ----------------------------------------------------------------
// useTheme hook
// ----------------------------------------------------------------

/**
 * Returns the current theme and helpers to change it.
 *
 * @example
 *   const { theme, toggleTheme } = useTheme();
 *   <button onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a <ThemeProvider>.');
  }
  return ctx;
}

export default ThemeProvider;
