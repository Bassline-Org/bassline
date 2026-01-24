/**
 * PageTransition - Route transition wrapper
 *
 * Wrap page content for smooth transitions between routes.
 * Use with AnimatePresence at the router level.
 */

import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef } from 'react'
import { timing, easing } from '@/lib/motion'

export type PageTransitionType = 'fade' | 'slideLeft' | 'slideRight' | 'slideUp' | 'scale'

export interface PageTransitionProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'> {
  /** Transition type (default: 'fade') */
  type?: PageTransitionType
  /** Animation duration (default: timing.fast) */
  duration?: number
}

const transitionVariants: Record<PageTransitionType, {
  initial: Record<string, number>
  animate: Record<string, number>
  exit: Record<string, number>
}> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideLeft: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
}

export const PageTransition = forwardRef<HTMLDivElement, PageTransitionProps>(
  function PageTransition({ children, type = 'fade', duration = timing.fast, ...props }, ref) {
    const variant = transitionVariants[type]

    return (
      <motion.div
        ref={ref}
        initial={variant.initial}
        animate={variant.animate}
        exit={variant.exit}
        transition={{
          duration,
          ease: easing.ease,
        }}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)

export default PageTransition
