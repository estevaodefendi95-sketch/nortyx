/**
 * Design System Tokens
 * Centralized design constants for consistent styling across the application
 */

/**
 * Spacing Scale
 * Use these values instead of arbitrary spacing values
 */
export const SPACING = {
  xs: '0.25rem',  // 4px
  sm: '0.5rem',   // 8px
  md: '0.75rem',  // 12px
  lg: '1rem',     // 16px
  xl: '1.5rem',   // 24px
  '2xl': '2rem',  // 32px
  '3xl': '2.5rem', // 40px
  '4xl': '3rem',  // 48px
} as const;

/**
 * Typography Scale
 * Font sizes and line heights
 */
export const TYPOGRAPHY = {
  xs: {
    size: '12px',
    lineHeight: '16px',
    weight: 400,
  },
  sm: {
    size: '14px',
    lineHeight: '20px',
    weight: 400,
  },
  base: {
    size: '16px',
    lineHeight: '24px',
    weight: 400,
  },
  lg: {
    size: '18px',
    lineHeight: '28px',
    weight: 500,
  },
  xl: {
    size: '20px',
    lineHeight: '28px',
    weight: 500,
  },
  '2xl': {
    size: '24px',
    lineHeight: '32px',
    weight: 600,
  },
  '3xl': {
    size: '30px',
    lineHeight: '36px',
    weight: 700,
  },
  '4xl': {
    size: '36px',
    lineHeight: '40px',
    weight: 700,
  },
} as const;

/**
 * Font Weights
 * Semantic naming for font weights
 */
export const FONT_WEIGHTS = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * Border Radius
 * Consistent rounding across components
 */
export const BORDER_RADIUS = {
  sm: 'calc(var(--radius) - 4px)',
  md: 'calc(var(--radius) - 2px)',
  lg: 'var(--radius)',
  full: '9999px',
} as const;

/**
 * Shadows
 * Modern shadow styles for depth and elevation
 */
export const SHADOWS = {
  'soft-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
  'soft-md': '0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
  'soft-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
  'soft-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  'glow-primary': '0 0 20px rgba(59, 130, 246, 0.25)',
  'glow-success': '0 0 20px rgba(34, 197, 94, 0.25)',
} as const;

/**
 * Animations
 * Duration and easing functions
 */
export const ANIMATIONS = {
  durations: {
    fast: '0.15s',
    normal: '0.2s',
    slow: '0.3s',
    verySlow: '0.5s',
  },
  easing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    linear: 'linear',
  },
} as const;

/**
 * Transitions
 * Common transition patterns
 */
export const TRANSITIONS = {
  default: 'all 0.2s ease-out',
  color: 'color 0.15s ease-out',
  transform: 'transform 0.2s ease-out',
  all: 'all 0.2s ease-out',
  smooth: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

/**
 * Z-Index Scale
 * Consistent layering across the application
 */
export const Z_INDEX = {
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  offcanvas: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const;

/**
 * Breakpoints
 * Screen sizes for responsive design
 */
export const BREAKPOINTS = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

/**
 * Colors
 * Semantic color values
 */
export const SEMANTIC_COLORS = {
  success: 'hsl(132, 50%, 50%)',
  warning: 'hsl(38, 92%, 50%)',
  error: 'hsl(0, 84%, 60%)',
  info: 'hsl(200, 100%, 50%)',
} as const;
