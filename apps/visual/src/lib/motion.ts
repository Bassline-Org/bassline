/**
 * Motion System - Unified animation tokens and variants
 *
 * Provides consistent timing, easing, and animation variants
 * for framer-motion throughout the application.
 */

import type { Transition, Variants } from 'framer-motion'

// Timing constants (in seconds)
export const timing = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.2,
  smooth: 0.3,
  slow: 0.5,
} as const

// Easing curves
export const easing = {
  // General use - subtle acceleration/deceleration
  ease: [0.25, 0.1, 0.25, 1] as const,
  // Elements entering view
  easeOut: [0, 0, 0.2, 1] as const,
  // Elements exiting view
  easeIn: [0.4, 0, 1, 1] as const,
  // Snappy, bouncy feel
  spring: { type: 'spring', stiffness: 400, damping: 30 } as const,
  // Gentler spring for larger movements
  springGentle: { type: 'spring', stiffness: 300, damping: 25 } as const,
  // Soft spring for subtle effects
  springSoft: { type: 'spring', stiffness: 200, damping: 20 } as const,
} as const

// Common transitions
export const transitions = {
  // Button press
  button: { type: 'spring', stiffness: 400, damping: 30 } as Transition,
  // Card hover
  hover: { duration: timing.normal, ease: easing.easeOut } as Transition,
  // Modal/dialog
  modal: { duration: timing.normal, ease: easing.easeOut } as Transition,
  // Page transition
  page: { duration: timing.fast, ease: easing.ease } as Transition,
  // List stagger
  stagger: { staggerChildren: 0.05 } as Transition,
  // Loading animations
  loading: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } as Transition,
} as const

// Animation variants for common patterns
export const variants = {
  // Simple fade
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  } as Variants,

  // Fade with upward motion
  fadeUp: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 8 },
  } as Variants,

  // Fade with downward motion (for dropdowns)
  fadeDown: {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  } as Variants,

  // Scale with fade (for modals)
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  } as Variants,

  // Slide from right
  slideInRight: {
    initial: { x: 20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 20, opacity: 0 },
  } as Variants,

  // Slide from left
  slideInLeft: {
    initial: { x: -20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 },
  } as Variants,

  // For staggered list containers
  staggerContainer: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  } as Variants,

  // For staggered list items
  staggerItem: {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  } as Variants,

  // For staggered grid items (smaller movement)
  staggerGridItem: {
    hidden: { opacity: 0, y: 12, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1 },
  } as Variants,
} as const

// Hover/tap animations for interactive elements
export const interactions = {
  // Button press effect
  button: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: easing.spring,
  },

  // Subtle button (for icon buttons, etc.)
  buttonSubtle: {
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 },
    transition: easing.spring,
  },

  // Card lift on hover
  cardLift: {
    whileHover: {
      y: -4,
      boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
    },
    transition: { duration: timing.normal, ease: easing.easeOut },
  },

  // Subtle card highlight
  cardHighlight: {
    whileHover: {
      scale: 1.01,
      boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
    },
    transition: { duration: timing.fast, ease: easing.easeOut },
  },
} as const

// Check for reduced motion preference
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Get transition based on motion preference
export function getTransition(transition: Transition): Transition {
  if (prefersReducedMotion()) {
    return { duration: 0 }
  }
  return transition
}
