import React from 'react'
import type { ReactNode } from 'react'
import { ContextFrameStackProvider } from './ContextFrameStackContext'
import { UIStackAdapter } from './FrameStackAdapter'

interface StackMigrationProviderProps {
  children: ReactNode
}

/**
 * Migration provider that replaces both UIStackProvider and ContextFrameProvider
 * with the new unified ContextFrameStackProvider while maintaining backward compatibility.
 * 
 * Usage:
 * Replace:
 *   <UIStackProvider>
 *     <ContextFrameProvider>
 *       {children}
 *     </ContextFrameProvider>
 *   </UIStackProvider>
 * 
 * With:
 *   <StackMigrationProvider>
 *     {children}
 *   </StackMigrationProvider>
 */
export function StackMigrationProvider({ children }: StackMigrationProviderProps) {
  return (
    <ContextFrameStackProvider>
      <UIStackAdapter>
        {children}
      </UIStackAdapter>
    </ContextFrameStackProvider>
  )
}