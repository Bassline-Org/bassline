/**
 * Skeleton - Loading placeholder with pulse animation
 *
 * Uses framer-motion for smooth, consistent animations.
 */

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <motion.div
      className={cn('bg-muted rounded', className)}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

// Preset skeleton shapes
export function SkeletonText({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-4 w-full', className)} />
}

export function SkeletonTitle({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-6 w-3/4', className)} />
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <Skeleton className="h-32 w-full rounded-lg" />
      <SkeletonTitle />
      <SkeletonText className="w-1/2" />
    </div>
  )
}

export function SkeletonAvatar({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-10 w-10 rounded-full', className)} />
}

export default Skeleton
