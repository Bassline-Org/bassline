/**
 * StaggerList - Container for staggered child animations
 *
 * Children animate in sequence with configurable stagger delay.
 * Use with StaggerItem for coordinated list animations.
 */

import { motion, AnimatePresence, type HTMLMotionProps } from 'framer-motion'
import { forwardRef, Children, isValidElement, type ReactNode } from 'react'
import { timing, easing } from '@/lib/motion'

export interface StaggerListProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  /** Delay between each child animation (default: 0.05s) */
  staggerDelay?: number
  /** Initial delay before first child animates */
  initialDelay?: number
  /** Animation duration for each child */
  childDuration?: number
  /** Movement distance in pixels (default: 12) */
  distance?: number
  /** Whether to animate presence changes */
  animatePresence?: boolean
  /** Children to animate */
  children?: ReactNode
}

export const StaggerList = forwardRef<HTMLDivElement, StaggerListProps>(function StaggerList(
  {
    children,
    staggerDelay = 0.05,
    initialDelay = 0,
    childDuration = timing.normal,
    distance = 12,
    animatePresence = true,
    ...props
  },
  ref
) {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: initialDelay,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: distance, scale: 0.98 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: childDuration,
        ease: easing.easeOut,
      },
    },
    exit: {
      opacity: 0,
      y: -distance / 2,
      transition: {
        duration: childDuration * 0.75,
      },
    },
  }

  const wrappedChildren = Children.map(children, (child, index) => {
    if (!isValidElement(child)) return child

    return (
      <motion.div key={child.key ?? index} variants={itemVariants}>
        {child}
      </motion.div>
    )
  })

  const content = (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate="show"
      {...props}
    >
      {wrappedChildren}
    </motion.div>
  )

  if (animatePresence) {
    return <AnimatePresence mode="popLayout">{content}</AnimatePresence>
  }

  return content
})

/**
 * StaggerItem - Individual item for manual stagger control
 *
 * Use when you need more control over each item's animation.
 */
export interface StaggerItemProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  /** Index for calculating delay */
  index?: number
  /** Stagger delay multiplier */
  staggerDelay?: number
}

export const StaggerItem = forwardRef<HTMLDivElement, StaggerItemProps>(function StaggerItem(
  { children, index = 0, staggerDelay = 0.05, ...props },
  ref
) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{
        duration: timing.normal,
        delay: index * staggerDelay,
        ease: easing.easeOut,
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
})

export default StaggerList
