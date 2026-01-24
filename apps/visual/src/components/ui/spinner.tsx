/**
 * Spinner - Loading indicator with rotation animation
 *
 * Uses framer-motion for smooth, consistent animations.
 */

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'w-4 h-4 border-[1.5px]',
  md: 'w-5 h-5 border-2',
  lg: 'w-8 h-8 border-2',
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <motion.div
      className={cn(
        'rounded-full border-primary/20 border-t-primary',
        sizes[size],
        className
      )}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
    />
  )
}

// Spinner with label
export function SpinnerWithLabel({
  label,
  size = 'md',
  className,
}: SpinnerProps & { label?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Spinner size={size} />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  )
}

export default Spinner
