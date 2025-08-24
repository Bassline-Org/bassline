/**
 * React Affordance Components
 * 
 * React components that handle user interactions and connect them to 
 * affordance gadgets in the propagation network. They use readers/writers
 * to wire the affordances to specific cells in the network.
 */

import React, { useEffect, useRef, useCallback } from 'react'
import { useNetwork, useGadget, useCell } from './hooks'
import { 
  TapAffordance, 
  DragAffordance, 
  HoverAffordance, 
  TypeAffordance, 
  DropAffordance 
} from '../../proper-bassline/src/affordances'
import type { Cell } from '../../proper-bassline/src/cell'
import type { InputEvent } from '../../proper-bassline/src/affordance'
import { bool, num, dict, str } from '../../proper-bassline/src/types'

// ============================================================================
// Types
// ============================================================================

interface BaseAffordanceProps {
  id?: string
  gadget?: any  // Existing affordance gadget
  writers?: Cell[]  // Cells to write output to
  readers?: Cell[]  // Cells to read configuration from
  children?: React.ReactNode
}

// ============================================================================
// TapAffordance React Component
// ============================================================================

interface TapAffordanceProps extends BaseAffordanceProps {
  onTap?: () => void
  disabled?: boolean
}

export function TapAffordanceComponent({
  id = 'tap',
  gadget: existingGadget,
  writers = [],
  readers = [],
  onTap,
  disabled = false,
  children
}: TapAffordanceProps) {
  // If we have gadget/writers/readers, use connected mode
  if (existingGadget || writers.length > 0 || readers.length > 0) {
    return <ConnectedTapAffordance 
      id={id}
      gadget={existingGadget}
      writers={writers}
      readers={readers}
      onTap={onTap}
      disabled={disabled}
    >
      {children}
    </ConnectedTapAffordance>
  }
  
  // Otherwise, render simple static interaction
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (disabled || !onTap) return
    onTap()
  }, [disabled, onTap])
  
  return (
    <div 
      onClick={handleClick}
      style={{ cursor: disabled ? 'default' : 'pointer' }}
      data-affordance-id={id}
      data-affordance-type="tap"
      data-static="true"
    >
      {children}
    </div>
  )
}

// Connected version that uses the gadget system
function ConnectedTapAffordance({
  id,
  gadget: existingGadget,
  writers = [],
  readers = [],
  onTap,
  disabled = false,
  children
}: TapAffordanceProps) {
  const network = useNetwork()
  
  // Use existing gadget or create new one
  const tapAffordance = useGadget(() => {
    if (existingGadget) return existingGadget
    return new TapAffordance(id)
  }, existingGadget ? existingGadget.id : id)
  
  // Wire to writer cells
  useEffect(() => {
    for (const writer of writers) {
      writer.connectFrom(tapAffordance.output)
    }
  }, [tapAffordance, writers])
  
  // Wire from reader cells
  useEffect(() => {
    // Wire enabled state if provided
    if (readers.length > 0) {
      tapAffordance.enabled.connectFrom(readers[0])
    }
    // Wire bounds if provided
    if (readers.length > 1) {
      tapAffordance.bounds.connectFrom(readers[1])
    }
  }, [tapAffordance, readers])
  
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (disabled) return
    
    const rect = event.currentTarget.getBoundingClientRect()
    const inputEvent: InputEvent = {
      type: 'tap',
      position: { 
        x: event.clientX - rect.left, 
        y: event.clientY - rect.top 
      },
      button: event.button
    }
    
    // Send to affordance
    const handled = tapAffordance.handleInput(inputEvent)
    
    if (handled && onTap) {
      onTap()
    }
  }, [tapAffordance, disabled, onTap])
  
  return (
    <div 
      onClick={handleClick}
      style={{ cursor: disabled ? 'default' : 'pointer' }}
      data-affordance-id={tapAffordance.id}
      data-affordance-type="tap"
      data-connected="true"
    >
      {children}
    </div>
  )
}

// ============================================================================
// DragAffordance React Component
// ============================================================================

interface DragAffordanceProps extends BaseAffordanceProps {
  onDragStart?: () => void
  onDrag?: (position: { x: number, y: number }) => void
  onDragEnd?: () => void
  disabled?: boolean
}

export function DragAffordanceComponent({
  id = 'drag',
  gadget: existingGadget,
  writers = [],
  readers = [],
  onDragStart,
  onDrag,
  onDragEnd,
  disabled = false,
  children
}: DragAffordanceProps) {
  // If we have gadget/writers/readers, use connected mode
  if (existingGadget || writers.length > 0 || readers.length > 0) {
    return <ConnectedDragAffordance 
      id={id}
      gadget={existingGadget}
      writers={writers}
      readers={readers}
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      disabled={disabled}
    >
      {children}
    </ConnectedDragAffordance>
  }
  
  // Simple static drag implementation
  const isDragging = useRef(false)
  const lastPosition = useRef({ x: 0, y: 0 })
  
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (disabled) return
    
    isDragging.current = true
    lastPosition.current = { x: event.clientX, y: event.clientY }
    
    if (onDragStart) {
      onDragStart()
    }
    
    event.preventDefault()
  }, [disabled, onDragStart])
  
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging.current || disabled) return
    
    if (onDrag) {
      onDrag({ x: event.clientX, y: event.clientY })
    }
    
    lastPosition.current = { x: event.clientX, y: event.clientY }
  }, [disabled, onDrag])
  
  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return
    
    isDragging.current = false
    
    if (onDragEnd) {
      onDragEnd()
    }
  }, [onDragEnd])
  
  // Global mouse events for dragging
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])
  
  return (
    <div 
      onMouseDown={handleMouseDown}
      style={{ cursor: disabled ? 'default' : 'grab' }}
      data-affordance-id={id}
      data-affordance-type="drag"
      data-static="true"
    >
      {children}
    </div>
  )
}

// Connected version that uses the gadget system
function ConnectedDragAffordance({
  id,
  gadget: existingGadget,
  writers = [],
  readers = [],
  onDragStart,
  onDrag,
  onDragEnd,
  disabled = false,
  children
}: DragAffordanceProps) {
  const network = useNetwork()
  const isDragging = useRef(false)
  const lastPosition = useRef({ x: 0, y: 0 })
  
  // Use existing gadget or create new one
  const dragAffordance = useGadget(() => {
    if (existingGadget) return existingGadget
    return new DragAffordance(id)
  }, existingGadget ? existingGadget.id : id)
  
  // Wire to writer cells
  useEffect(() => {
    for (const writer of writers) {
      writer.connectFrom(dragAffordance.output)
    }
  }, [dragAffordance, writers])
  
  // Wire from reader cells
  useEffect(() => {
    // Wire enabled state if provided
    if (readers.length > 0) {
      dragAffordance.enabled.connectFrom(readers[0])
    }
    // Wire bounds if provided
    if (readers.length > 1) {
      dragAffordance.bounds.connectFrom(readers[1])
    }
  }, [dragAffordance, readers])
  
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (disabled) return
    
    isDragging.current = true
    lastPosition.current = { x: event.clientX, y: event.clientY }
    
    const rect = event.currentTarget.getBoundingClientRect()
    const inputEvent: InputEvent = {
      type: 'drag',
      position: { 
        x: event.clientX - rect.left, 
        y: event.clientY - rect.top 
      },
      data: { dragStart: true }
    }
    
    dragAffordance.handleInput(inputEvent)
    
    if (onDragStart) {
      onDragStart()
    }
    
    event.preventDefault()
  }, [dragAffordance, disabled, onDragStart])
  
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging.current || disabled) return
    
    const delta = {
      x: event.clientX - lastPosition.current.x,
      y: event.clientY - lastPosition.current.y
    }
    
    const inputEvent: InputEvent = {
      type: 'drag',
      position: { x: event.clientX, y: event.clientY },
      delta: delta
    }
    
    dragAffordance.handleInput(inputEvent)
    
    if (onDrag) {
      onDrag({ x: event.clientX, y: event.clientY })
    }
    
    lastPosition.current = { x: event.clientX, y: event.clientY }
  }, [dragAffordance, disabled, onDrag])
  
  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return
    
    isDragging.current = false
    
    const inputEvent: InputEvent = {
      type: 'drag',
      data: { dragEnd: true }
    }
    
    dragAffordance.handleInput(inputEvent)
    
    if (onDragEnd) {
      onDragEnd()
    }
  }, [dragAffordance, onDragEnd])
  
  // Global mouse events for dragging
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])
  
  return (
    <div 
      onMouseDown={handleMouseDown}
      style={{ cursor: disabled ? 'default' : 'grab' }}
      data-affordance-id={dragAffordance.id}
      data-affordance-type="drag"
      data-connected="true"
    >
      {children}
    </div>
  )
}

// ============================================================================
// HoverAffordance React Component
// ============================================================================

interface HoverAffordanceProps extends BaseAffordanceProps {
  onHover?: (hovering: boolean) => void
  disabled?: boolean
}

export function HoverAffordanceComponent({
  id = 'hover',
  gadget: existingGadget,
  writers = [],
  readers = [],
  onHover,
  disabled = false,
  children
}: HoverAffordanceProps) {
  // If we have gadget/writers/readers, use connected mode
  if (existingGadget || writers.length > 0 || readers.length > 0) {
    return <ConnectedHoverAffordance 
      id={id}
      gadget={existingGadget}
      writers={writers}
      readers={readers}
      onHover={onHover}
      disabled={disabled}
    >
      {children}
    </ConnectedHoverAffordance>
  }
  
  // Simple static hover implementation
  const handleMouseEnter = useCallback(() => {
    if (disabled || !onHover) return
    onHover(true)
  }, [disabled, onHover])
  
  const handleMouseLeave = useCallback(() => {
    if (disabled || !onHover) return
    onHover(false)
  }, [disabled, onHover])
  
  return (
    <div 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-affordance-id={id}
      data-affordance-type="hover"
      data-static="true"
    >
      {children}
    </div>
  )
}

// Connected version that uses the gadget system
function ConnectedHoverAffordance({
  id,
  gadget: existingGadget,
  writers = [],
  readers = [],
  onHover,
  disabled = false,
  children
}: HoverAffordanceProps) {
  const network = useNetwork()
  
  // Use existing gadget or create new one
  const hoverAffordance = useGadget(() => {
    if (existingGadget) return existingGadget
    return new HoverAffordance(id)
  }, existingGadget ? existingGadget.id : id)
  
  // Wire to writer cells
  useEffect(() => {
    for (const writer of writers) {
      writer.connectFrom(hoverAffordance.output)
    }
  }, [hoverAffordance, writers])
  
  // Wire from reader cells
  useEffect(() => {
    // Wire enabled state if provided
    if (readers.length > 0) {
      hoverAffordance.enabled.connectFrom(readers[0])
    }
    // Wire bounds if provided
    if (readers.length > 1) {
      hoverAffordance.bounds.connectFrom(readers[1])
    }
  }, [hoverAffordance, readers])
  
  const handleMouseEnter = useCallback((event: React.MouseEvent) => {
    if (disabled) return
    
    const rect = event.currentTarget.getBoundingClientRect()
    const inputEvent: InputEvent = {
      type: 'hover',
      position: { 
        x: event.clientX - rect.left, 
        y: event.clientY - rect.top 
      },
      data: { hovering: true }
    }
    
    hoverAffordance.handleInput(inputEvent)
    
    if (onHover) {
      onHover(true)
    }
  }, [hoverAffordance, disabled, onHover])
  
  const handleMouseLeave = useCallback((event: React.MouseEvent) => {
    if (disabled) return
    
    const inputEvent: InputEvent = {
      type: 'hover',
      data: { hovering: false }
    }
    
    hoverAffordance.handleInput(inputEvent)
    
    if (onHover) {
      onHover(false)
    }
  }, [hoverAffordance, disabled, onHover])
  
  return (
    <div 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-affordance-id={hoverAffordance.id}
      data-affordance-type="hover"
      data-connected="true"
    >
      {children}
    </div>
  )
}

// ============================================================================
// TypeAffordance React Component
// ============================================================================

interface TypeAffordanceProps extends BaseAffordanceProps {
  initialText?: string
  multiline?: boolean
  placeholder?: string
  onTextChange?: (text: string) => void
  disabled?: boolean
}

export function TypeAffordanceComponent({
  id = 'type',
  gadget: existingGadget,
  writers = [],
  readers = [],
  initialText = '',
  multiline = false,
  placeholder = '',
  onTextChange,
  disabled = false
}: TypeAffordanceProps) {
  // If we have gadget/writers/readers, use connected mode
  if (existingGadget || writers.length > 0 || readers.length > 0) {
    return <ConnectedTypeAffordance 
      id={id}
      gadget={existingGadget}
      writers={writers}
      readers={readers}
      initialText={initialText}
      multiline={multiline}
      placeholder={placeholder}
      onTextChange={onTextChange}
      disabled={disabled}
    />
  }
  
  // Simple static text input
  const Element = multiline ? 'textarea' : 'input'
  
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (onTextChange) {
      onTextChange(event.target.value)
    }
  }, [onTextChange])
  
  return (
    <Element
      type={multiline ? undefined : 'text'}
      defaultValue={initialText}
      placeholder={placeholder}
      disabled={disabled}
      onChange={handleChange}
      data-affordance-id={id}
      data-affordance-type="type"
      data-static="true"
      style={{
        border: '1px solid #ccc',
        padding: '4px 8px',
        borderRadius: '4px'
      }}
    />
  )
}

// Connected version that uses the gadget system
function ConnectedTypeAffordance({
  id,
  gadget: existingGadget,
  writers = [],
  readers = [],
  initialText = '',
  multiline = false,
  placeholder = '',
  onTextChange,
  disabled = false
}: TypeAffordanceProps) {
  const network = useNetwork()
  
  // Use existing gadget or create new one
  const typeAffordance = useGadget(() => {
    if (existingGadget) return existingGadget
    return new TypeAffordance(id, undefined, initialText)
  }, existingGadget ? existingGadget.id : id)
  
  // Wire to writer cells
  useEffect(() => {
    for (const writer of writers) {
      writer.connectFrom(typeAffordance.output)
    }
  }, [typeAffordance, writers])
  
  // Wire from reader cells
  useEffect(() => {
    // Wire enabled state if provided
    if (readers.length > 0) {
      typeAffordance.enabled.connectFrom(readers[0])
    }
  }, [typeAffordance, readers])
  
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return
    
    const inputEvent: InputEvent = {
      type: 'key',
      key: event.key,
      modifiers: {
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        meta: event.metaKey
      }
    }
    
    typeAffordance.handleInput(inputEvent)
    
    // Get updated text and call callback
    if (onTextChange) {
      // Small delay to let the affordance process the input
      setTimeout(() => {
        const text = typeAffordance.getText()
        onTextChange(text)
      }, 0)
    }
  }, [typeAffordance, disabled, onTextChange])
  
  const Element = multiline ? 'textarea' : 'input'
  
  return (
    <Element
      type={multiline ? undefined : 'text'}
      defaultValue={initialText}
      placeholder={placeholder}
      disabled={disabled}
      onKeyDown={handleKeyDown}
      data-affordance-id={typeAffordance.id}
      data-affordance-type="type"
      data-connected="true"
      style={{
        border: '1px solid #ccc',
        padding: '4px 8px',
        borderRadius: '4px'
      }}
    />
  )
}

// ============================================================================
// Composite Affordance Component
// ============================================================================

interface InteractiveProps {
  tap?: TapAffordanceProps
  drag?: DragAffordanceProps
  hover?: HoverAffordanceProps
  type?: TypeAffordanceProps
  children: React.ReactNode
}

/**
 * Composite component that can combine multiple affordances
 */
export function Interactive({ 
  tap, 
  drag, 
  hover, 
  type,
  children 
}: InteractiveProps) {
  let content = children
  
  // Wrap with affordances (innermost first)
  if (type) {
    content = (
      <TypeAffordanceComponent {...type}>
        {content}
      </TypeAffordanceComponent>
    )
  }
  
  if (hover) {
    content = (
      <HoverAffordanceComponent {...hover}>
        {content}
      </HoverAffordanceComponent>
    )
  }
  
  if (drag) {
    content = (
      <DragAffordanceComponent {...drag}>
        {content}
      </DragAffordanceComponent>
    )
  }
  
  if (tap) {
    content = (
      <TapAffordanceComponent {...tap}>
        {content}
      </TapAffordanceComponent>
    )
  }
  
  return <>{content}</>
}