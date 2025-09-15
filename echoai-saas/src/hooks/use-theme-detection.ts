"use client"

import { useState, useEffect } from 'react'

export function useThemeDetection() {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isSystemTheme, setIsSystemTheme] = useState(true)

  useEffect(() => {
    // Check if user has a stored theme preference
    const storedTheme = localStorage.getItem('theme')
    
    if (storedTheme && storedTheme !== 'system') {
      setIsDarkMode(storedTheme === 'dark')
      setIsSystemTheme(false)
    } else {
      // Use system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      setIsDarkMode(mediaQuery.matches)
      setIsSystemTheme(true)
      
      const handleChange = (e: MediaQueryListEvent) => {
        if (isSystemTheme) {
          setIsDarkMode(e.matches)
        }
      }
      
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [isSystemTheme])

  // Listen for theme changes from the main app
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme') {
        const newTheme = e.newValue
        if (newTheme === 'system' || !newTheme) {
          setIsSystemTheme(true)
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
          setIsDarkMode(mediaQuery.matches)
        } else {
          setIsSystemTheme(false)
          setIsDarkMode(newTheme === 'dark')
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return { isDarkMode, isSystemTheme }
}