/**
 * React components that ARE gadgets in the propagation network
 * These components use templates to participate directly in propagation
 */

import React, { type CSSProperties } from 'react'
import { useTemplate, useContact, useGadgetValue } from './react-templates'
import {
  ButtonTemplate,
  SliderTemplate,
  TextFieldTemplate,
  PanelTemplate,
  ToggleTemplate,
  SelectTemplate
} from './ui-templates'

// ============================================================================
// Button Component
// ============================================================================

interface ButtonProps {
  text?: string
  enabled?: boolean
  style?: CSSProperties
  onClicked?: () => void
}

export function Button({ text = 'Button', enabled = true, style = {}, onClicked }: ButtonProps) {
  const { gadget, inputs, outputs } = useTemplate(ButtonTemplate, { text, enabled })
  
  const [buttonText, setText] = useContact<string>(gadget, 'text')
  const [isEnabled, setEnabled] = useContact<boolean>(gadget, 'enabled')
  const [clicked, setClicked] = useContact<boolean>(gadget, 'clicked')
  const [clickCount, setClickCount] = useContact<number>(gadget, 'clickCount')
  
  // Sync props to gadget state when they change
  React.useEffect(() => {
    setText(text)
  }, [text, setText])
  
  React.useEffect(() => {
    setEnabled(enabled)
  }, [enabled, setEnabled])
  
  const handleClick = () => {
    if (!isEnabled) return
    
    // Update gadget state
    setClicked(true)
    setClickCount((clickCount || 0) + 1)
    
    // Call handler if provided
    onClicked?.()
    
    // Reset clicked flag after a frame
    requestAnimationFrame(() => setClicked(false))
  }
  
  return (
    <button
      onClick={handleClick}
      disabled={!isEnabled}
      style={{
        padding: '8px 16px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        background: isEnabled ? '#fff' : '#f5f5f5',
        cursor: isEnabled ? 'pointer' : 'not-allowed',
        ...style
      }}
    >
      {buttonText}
    </button>
  )
}

// ============================================================================
// Slider Component
// ============================================================================

interface SliderProps {
  value?: number
  min?: number
  max?: number
  step?: number
  enabled?: boolean
  onChange?: (value: number) => void
}

export function Slider({ 
  value = 50, 
  min = 0, 
  max = 100, 
  step = 1, 
  enabled = true,
  onChange 
}: SliderProps) {
  const { gadget } = useTemplate(SliderTemplate, { value, min, max, step, enabled })
  
  const [currentValue, setValue] = useContact<number>(gadget, 'value')
  const [isEnabled] = useContact<boolean>(gadget, 'enabled')
  const [, setDragging] = useContact<boolean>(gadget, 'isDragging')
  const normalizedValue = useGadgetValue<number>(gadget, 'normalizedValue')
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    setValue(newValue)
    onChange?.(newValue)
  }
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <input
        type="range"
        value={currentValue || 0}
        min={min}
        max={max}
        step={step}
        disabled={!isEnabled}
        onChange={handleChange}
        onMouseDown={() => setDragging(true)}
        onMouseUp={() => setDragging(false)}
        style={{
          flex: 1,
          cursor: isEnabled ? 'pointer' : 'not-allowed'
        }}
      />
      <span style={{ minWidth: '50px', textAlign: 'right' }}>
        {currentValue?.toFixed(1)}
      </span>
      {normalizedValue !== null && (
        <span style={{ fontSize: '0.8em', color: '#666' }}>
          ({(normalizedValue * 100).toFixed(0)}%)
        </span>
      )}
    </div>
  )
}

// ============================================================================
// TextField Component
// ============================================================================

interface TextFieldProps {
  text?: string
  placeholder?: string
  maxLength?: number
  enabled?: boolean
  validation?: string
  onChange?: (text: string) => void
}

export function TextField({
  text = '',
  placeholder = 'Enter text...',
  maxLength = 100,
  enabled = true,
  validation = '.*',
  onChange
}: TextFieldProps) {
  const { gadget } = useTemplate(TextFieldTemplate, { 
    text, placeholder, maxLength, enabled, validation 
  })
  
  const [currentText, setText] = useContact<string>(gadget, 'text')
  const [isEnabled] = useContact<boolean>(gadget, 'enabled')
  const [, setFocused] = useContact<boolean>(gadget, 'isFocused')
  const isValid = useGadgetValue<boolean>(gadget, 'isValid')
  const length = useGadgetValue<number>(gadget, 'length')
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value
    if (newText.length <= maxLength) {
      setText(newText)
      onChange?.(newText)
    }
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <input
        type="text"
        value={currentText || ''}
        placeholder={placeholder}
        disabled={!isEnabled}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          padding: '8px',
          borderRadius: '4px',
          border: `1px solid ${isValid ? '#ccc' : '#f00'}`,
          background: isEnabled ? '#fff' : '#f5f5f5'
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', color: '#666' }}>
        <span>{isValid ? '✓ Valid' : '✗ Invalid'}</span>
        <span>{length}/{maxLength}</span>
      </div>
    </div>
  )
}

// ============================================================================
// Panel Component
// ============================================================================

interface PanelProps {
  x?: number
  y?: number
  width?: number
  height?: number
  title?: string
  visible?: boolean
  children?: React.ReactNode
  onMove?: (x: number, y: number) => void
  onResize?: (width: number, height: number) => void
}

export function Panel({
  x = 0,
  y = 0,
  width = 200,
  height = 150,
  title = 'Panel',
  visible = true,
  children,
  onMove,
  onResize
}: PanelProps) {
  const { gadget } = useTemplate(PanelTemplate, {
    x, y, width, height, visible, title
  })
  
  const [currentX, setX] = useContact<number>(gadget, 'x')
  const [currentY, setY] = useContact<number>(gadget, 'y')
  const [currentWidth, setWidth] = useContact<number>(gadget, 'width')
  const [currentHeight, setHeight] = useContact<number>(gadget, 'height')
  const [isVisible] = useContact<boolean>(gadget, 'visible')
  const [currentTitle] = useContact<string>(gadget, 'title')
  const [, setDragging] = useContact<boolean>(gadget, 'isDragging')
  const [, setFocus] = useContact<boolean>(gadget, 'hasFocus')
  
  const [dragStart, setDragStart] = React.useState<{ x: number, y: number } | null>(null)
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('panel-header')) {
      setDragStart({ x: e.clientX - (currentX || 0), y: e.clientY - (currentY || 0) })
      setDragging(true)
      setFocus(true)
    }
  }
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStart) {
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y
      setX(newX)
      setY(newY)
      onMove?.(newX, newY)
    }
  }
  
  const handleMouseUp = () => {
    setDragStart(null)
    setDragging(false)
  }
  
  if (!isVisible) return null
  
  return (
    <div
      style={{
        position: 'absolute',
        left: currentX,
        top: currentY,
        width: currentWidth,
        height: currentHeight,
        border: '1px solid #ccc',
        borderRadius: '4px',
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div 
        className="panel-header"
        style={{
          padding: '8px',
          background: '#f5f5f5',
          borderBottom: '1px solid #ccc',
          cursor: 'move',
          userSelect: 'none'
        }}
      >
        {currentTitle}
      </div>
      <div style={{ flex: 1, padding: '8px', overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

// ============================================================================
// Toggle Component
// ============================================================================

interface ToggleProps {
  checked?: boolean
  enabled?: boolean
  label?: string
  onChange?: (checked: boolean) => void
}

export function Toggle({
  checked = false,
  enabled = true,
  label = '',
  onChange
}: ToggleProps) {
  const { gadget } = useTemplate(ToggleTemplate, { checked, enabled, label })
  
  const [isChecked, setChecked] = useContact<boolean>(gadget, 'checked')
  const [isEnabled] = useContact<boolean>(gadget, 'enabled')
  const [currentLabel] = useContact<string>(gadget, 'label')
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newChecked = e.target.checked
    setChecked(newChecked)
    onChange?.(newChecked)
  }
  
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isEnabled ? 'pointer' : 'not-allowed' }}>
      <input
        type="checkbox"
        checked={isChecked || false}
        disabled={!isEnabled}
        onChange={handleChange}
      />
      {currentLabel && <span>{currentLabel}</span>}
    </label>
  )
}

// ============================================================================
// Select Component
// ============================================================================

interface SelectProps {
  value?: string
  options?: string[]
  enabled?: boolean
  onChange?: (value: string) => void
}

export function Select({
  value = '',
  options = [],
  enabled = true,
  onChange
}: SelectProps) {
  const { gadget } = useTemplate(SelectTemplate, { value, options, enabled })
  
  const [currentValue, setValue] = useContact<string>(gadget, 'value')
  const [currentOptions] = useContact<string[]>(gadget, 'options')
  const [isEnabled] = useContact<boolean>(gadget, 'enabled')
  const selectedIndex = useGadgetValue<number>(gadget, 'selectedIndex')
  
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value
    setValue(newValue)
    onChange?.(newValue)
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <select
        value={currentValue || ''}
        disabled={!isEnabled}
        onChange={handleChange}
        style={{
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          background: isEnabled ? '#fff' : '#f5f5f5',
          cursor: isEnabled ? 'pointer' : 'not-allowed'
        }}
      >
        <option value="">Select...</option>
        {Array.isArray(currentOptions) && currentOptions.map((option, i) => (
          <option key={i} value={option}>{option}</option>
        ))}
      </select>
      {selectedIndex !== null && selectedIndex >= 0 && (
        <span style={{ fontSize: '0.8em', color: '#666' }}>
          Selected: {selectedIndex + 1} of {(Array.isArray(currentOptions) ? currentOptions.length : 0)}
        </span>
      )}
    </div>
  )
}