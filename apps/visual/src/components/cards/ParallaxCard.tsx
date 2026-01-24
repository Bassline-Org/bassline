/**
 * ParallaxCard - Reusable tilt wrapper component
 *
 * Provides 3D parallax tilt effect using react-parallax-tilt.
 * Children can use data-parallax-offset for depth layers via CSS transforms.
 */

import Tilt from 'react-parallax-tilt'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface ParallaxCardProps {
  children: ReactNode
  onClick?: () => void
  className?: string
  /** Max X rotation in degrees (default: 15) */
  tiltMaxAngleX?: number
  /** Max Y rotation in degrees (default: 15) */
  tiltMaxAngleY?: number
  /** Enable glare effect (default: true) */
  glare?: boolean
  /** Max glare opacity (default: 0.2) */
  glareMaxOpacity?: number
  /** Scale on hover (default: 1.02) */
  scale?: number
  /** Transition speed in ms (default: 400) */
  transitionSpeed?: number
  /** Perspective distance (default: 1000) */
  perspective?: number
}

export function ParallaxCard({
  children,
  onClick,
  className,
  tiltMaxAngleX = 15,
  tiltMaxAngleY = 15,
  glare = true,
  glareMaxOpacity = 0.2,
  scale = 1.02,
  transitionSpeed = 400,
  perspective = 1000,
}: ParallaxCardProps) {
  return (
    <Tilt
      className={cn('parallax-card', className)}
      tiltMaxAngleX={tiltMaxAngleX}
      tiltMaxAngleY={tiltMaxAngleY}
      glareEnable={glare}
      glareMaxOpacity={glareMaxOpacity}
      glareColor="white"
      glarePosition="all"
      glareBorderRadius="12px"
      scale={scale}
      transitionSpeed={transitionSpeed}
      perspective={perspective}
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div
        onClick={onClick}
        style={{ transformStyle: 'preserve-3d', cursor: onClick ? 'pointer' : undefined }}
        className="h-full w-full"
      >
        {children}
      </div>
    </Tilt>
  )
}

export default ParallaxCard
