/**
 * FadeIn - Reusable fade-in animation wrapper
 *
 * Wraps children in a motion.div with configurable fade animation.
 */

import { motion, type HTMLMotionProps, type TargetAndTransition } from 'framer-motion'
import { forwardRef } from 'react'
import { timing, easing } from '@/lib/motion'

export type FadeDirection = 'up' | 'down' | 'left' | 'right' | 'none'

export interface FadeInProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'> {
  /** Animation direction (default: 'up') */
  direction?: FadeDirection
  /** Delay in seconds before animation starts */
  delay?: number
  /** Animation duration in seconds (default: timing.normal) */
  duration?: number
  /** Whether to animate on exit (for AnimatePresence) */
  exitAnimation?: boolean
}

type AnimationState = {
  initial: TargetAndTransition
  animate: TargetAndTransition
  exit: TargetAndTransition
}

const directionVariants: Record<FadeDirection, AnimationState> = {
  none: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  up: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 8 },
  },
  down: {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  },
  left: {
    initial: { x: -20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 },
  },
  right: {
    initial: { x: 20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 20, opacity: 0 },
  },
}

export const FadeIn = forwardRef<HTMLDivElement, FadeInProps>(function FadeIn(
  {
    children,
    direction = 'up',
    delay = 0,
    duration = timing.normal,
    exitAnimation = true,
    ...props
  },
  ref
) {
  const variant = directionVariants[direction]

  return (
    <motion.div
      ref={ref}
      initial={variant.initial}
      animate={variant.animate}
      exit={exitAnimation ? variant.exit : undefined}
      transition={{
        duration,
        delay,
        ease: easing.easeOut,
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
})

export default FadeIn
