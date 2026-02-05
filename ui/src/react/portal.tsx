import { createPortal } from 'react-dom'
import type { ReactNode, HTMLAttributes } from 'react'
import { useInspectorContext, type InspectorExtension } from './context'

// ============================================================================
// Inspector Slot Component
// ============================================================================

export interface InspectorSlotProps extends HTMLAttributes<HTMLDivElement> {
  /** Which slot to render extensions for */
  slot: 'bar' | 'actions' | 'search' | 'footer'
  /** Optional: filter extensions to a specific pane */
  paneId?: string
}

/**
 * Renders all extensions registered for a specific slot.
 * Use this in your inspector layout to define where extensions appear.
 */
export function InspectorSlot({ slot, paneId, className, ...props }: InspectorSlotProps) {
  const { extensions, portalRefs } = useInspectorContext()

  // Filter extensions for this slot (and optionally pane)
  const slotExtensions = extensions.filter(e => e.slot === slot && (paneId === undefined || e.paneId === paneId))

  // Get the ref for this slot
  const ref = portalRefs[slot]

  return (
    <div ref={ref} className={className} {...props}>
      {slotExtensions.map(ext => (
        <ExtensionRenderer key={ext.id} extension={ext} />
      ))}
    </div>
  )
}

/**
 * Internal component to render a single extension
 */
function ExtensionRenderer({ extension }: { extension: InspectorExtension }) {
  return <>{extension.render()}</>
}

// ============================================================================
// Portal Component
// ============================================================================

export interface InspectorPortalProps {
  /** Which slot to portal into */
  slot: 'bar' | 'actions' | 'search' | 'footer'
  /** Content to render in the slot */
  children: ReactNode
}

/**
 * Portal component for rendering content into an inspector slot.
 * Use this for one-off portal needs; for reusable extensions, use useExtension hook.
 */
export function InspectorPortal({ slot, children }: InspectorPortalProps) {
  const { portalRefs } = useInspectorContext()
  const targetRef = portalRefs[slot]

  if (!targetRef.current) {
    return null
  }

  return createPortal(children, targetRef.current)
}

// ============================================================================
// Portal Target Component
// ============================================================================

export interface InspectorPortalTargetProps extends HTMLAttributes<HTMLDivElement> {
  /** Which slot this target is for */
  slot: 'bar' | 'actions' | 'search' | 'footer'
}

/**
 * Marks an element as a portal target for a specific slot.
 * The InspectorProvider sets up refs for built-in slots,
 * but you can use this for custom positioning.
 */
export function InspectorPortalTarget({ slot, ...props }: InspectorPortalTargetProps) {
  const { portalRefs } = useInspectorContext()

  return <div ref={portalRefs[slot]} {...props} />
}
