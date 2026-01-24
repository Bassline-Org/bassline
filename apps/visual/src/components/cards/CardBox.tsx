/**
 * CardBox - Configurable container for card content
 *
 * This is the "box" that you can easily modify to change how cards are displayed.
 * Change the variant prop to switch between visual styles.
 */

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type CardBoxVariant = 'default' | 'elevated' | 'outlined' | 'glass'
export type CardBoxSize = 'sm' | 'md' | 'lg'

export interface CardBoxProps {
  children: ReactNode
  /** Visual style variant */
  variant?: CardBoxVariant
  /** Size affects padding */
  size?: CardBoxSize
  className?: string
}

const sizeStyles: Record<CardBoxSize, string> = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

const variantStyles: Record<CardBoxVariant, string> = {
  default: 'card-box',
  elevated: 'card-box card-box--elevated',
  outlined: 'card-box card-box--outlined',
  glass: 'card-box card-box--glass',
}

export function CardBox({
  children,
  variant = 'default',
  size = 'md',
  className,
}: CardBoxProps) {
  return (
    <div
      className={cn(
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </div>
  )
}

export default CardBox
