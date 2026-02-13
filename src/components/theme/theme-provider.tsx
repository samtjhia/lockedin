'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'lockedin-theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) as Theme | null) : null
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored)
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', stored === 'dark')
        }
        return
      }
    } catch (_) {
      // localStorage can throw in private browsing / some mobile browsers
    }
    setThemeState('dark')
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('dark')
    }
  }, [])

  const setThemeInternal = (next: Theme) => {
    setThemeState(next)
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, next)
        const root = document.documentElement
        if (next === 'dark') {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
      }
    } catch (_) {
      // ignore localStorage errors
    }
  }

  const value: ThemeContextValue = {
    theme,
    setTheme: setThemeInternal,
    toggleTheme: () => setThemeInternal(theme === 'dark' ? 'light' : 'dark'),
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}

