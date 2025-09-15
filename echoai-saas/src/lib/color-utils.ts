/**
 * Utility functions for color manipulation and theme support
 */

/**
 * Convert hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * Calculate luminance of a color (0-1 scale)
 */
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Determine if a color is light or dark
 */
export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return true // Default to light if invalid color
  
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b)
  return luminance > 0.5
}

/**
 * Get appropriate text color (black or white) for a background color
 */
export function getContrastTextColor(backgroundColor: string): string {
  return isLightColor(backgroundColor) ? '#000000' : '#ffffff'
}

/**
 * Lighten or darken a hex color by a percentage
 */
export function adjustColorBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  
  const adjust = (color: number) => {
    const adjusted = Math.round(color * (1 + percent / 100))
    return Math.max(0, Math.min(255, adjusted))
  }
  
  const r = adjust(rgb.r).toString(16).padStart(2, '0')
  const g = adjust(rgb.g).toString(16).padStart(2, '0')
  const b = adjust(rgb.b).toString(16).padStart(2, '0')
  
  return `#${r}${g}${b}`
}

/**
 * Generate CSS custom properties for a primary color theme
 */
export function generateColorTheme(primaryColor: string): Record<string, string> {
  const rgb = hexToRgb(primaryColor)
  const rgbString = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '59, 130, 246'
  
  return {
    '--chat-primary': primaryColor,
    '--chat-primary-rgb': rgbString,
    '--chat-primary-hover': adjustColorBrightness(primaryColor, -10),
    '--chat-primary-light': adjustColorBrightness(primaryColor, 20),
    '--chat-text-color': getContrastTextColor(primaryColor),
  }
}