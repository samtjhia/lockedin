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
    // Initialize from localStorage or system preference
    const stored = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) as Theme | null) : null
    if (stored === 'light' || stored === 'dark') {
      setThemeInternal(stored)
      return
    }

    // Default: dark
    setThemeInternal('dark')
  }, [])

  const setThemeInternal = (next: Theme) => {
    setThemeState(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next)
      const root = document.documentElement
      if (next === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
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

