/**
 * React Visual Components
 * 
 * React components that can either create new visual gadgets in the network
 * or render existing visual gadgets from the network. This enables bidirectional
 * integration between React and the propagation system.
 */

import React, { useEffect, useRef, CSSProperties } from 'react'
import { NetworkContext, useNetwork, useGadget, useCell } from './hooks'
import { 
  RectGadget, 
  TextGadget, 
  PathGadget, 
  GroupGadget,
  VisualGadget 
} from '../../proper-bassline/src/visuals'
import { getGadgetValue } from '../../proper-bassline/src/value-helpers'
import { num, str, dict, bool } from '../../proper-bassline/src/types'
import type { Point, Size } from '../../proper-bassline/src/visual-gadget'

// ============================================================================
// Types
// ============================================================================

interface BaseVisualProps {
  id?: string
  gadget?: VisualGadget  // Use existing gadget, or create new one
  position?: Point
  size?: Size
  visible?: boolean
  opacity?: number
  style?: CSSProperties
  className?: string
  children?: React.ReactNode
}

// ============================================================================
// RectGadget React Component
// ============================================================================

interface RectGadgetProps extends BaseVisualProps {
  color?: string
  borderRadius?: number
  borderWidth?: number
  borderColor?: string
}

export function RectGadgetComponent({ 
  id = 'rect',
  gadget: existingGadget,
  position = { x: 0, y: 0 },
  size = { width: 100, height: 100 },
  visible = true,
  opacity = 1,
  color = '#3b82f6',
  borderRadius = 4,
  borderWidth = 0,
  borderColor = '#000000',
  style = {},
  className = '',
  children
}: RectGadgetProps) {
  // Check if we're in a network context
  const context = React.useContext(NetworkContext)
  
  // If we have an existing gadget, use it
  if (existingGadget) {
    return <ConnectedRectGadget 
      gadget={existingGadget}
      style={style}
      className={className}
      color={color}
      borderRadius={borderRadius}
      borderWidth={borderWidth}
      borderColor={borderColor}
    >
      {children}
    </ConnectedRectGadget>
  }
  
  // If we're in a network context, create a gadget
  if (context) {
    return <AutoCreateRectGadget
      id={id}
      position={position}
      size={size}
      visible={visible}
      opacity={opacity}
      color={color}
      borderRadius={borderRadius}
      borderWidth={borderWidth}
      borderColor={borderColor}
      style={style}
      className={className}
    >
      {children}
    </AutoCreateRectGadget>
  }
  
  // Otherwise, render a static rect using just the props
  const computedStyle: CSSProperties = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    width: size.width,
    height: size.height,
    backgroundColor: color,
    borderRadius: borderRadius,
    borderWidth: borderWidth,
    borderColor: borderColor,
    borderStyle: borderWidth > 0 ? 'solid' : 'none',
    opacity: opacity,
    display: visible ? 'block' : 'none',
    boxSizing: 'border-box',
    ...style
  }
  
  return (
    <div 
      className={`visual-gadget rect-gadget static ${className}`}
      style={computedStyle}
      data-gadget-id={id}
      data-static="true"
    >
      {children}
    </div>
  )
}

// Auto-create version that creates a gadget in the network
function AutoCreateRectGadget(props: RectGadgetProps) {
  const { id = 'rect', position = { x: 0, y: 0 }, size = { width: 100, height: 100 },
    visible = true, opacity = 1, color = '#3b82f6', borderRadius = 4,
    borderWidth = 0, borderColor = '#000000', style = {}, className = '', children } = props
  
  // Create the gadget
  const gadget = useGadget(() => {
    const rect = new RectGadget(id)
    rect.setPosition(position.x, position.y)
    rect.setSize(size.width, size.height)
    rect.setBackgroundColor(color)
    rect.setBorderRadius(borderRadius)
    rect.setBorderWidth(borderWidth)
    rect.setBorderColor(borderColor)
    rect.visible.userInput(bool(visible))
    rect.opacity.userInput(num(opacity))
    console.log('Created RectGadget:', id, 'at position:', position)
    return rect
  }, id)
  
  // Update gadget when props change
  useEffect(() => {
    gadget.setPosition(position.x, position.y)
    gadget.setSize(size.width, size.height)
    gadget.setBackgroundColor(color)
    gadget.setBorderRadius(borderRadius)
    gadget.setBorderWidth(borderWidth)
    gadget.setBorderColor(borderColor)
    gadget.visible.userInput(bool(visible))
    gadget.opacity.userInput(num(opacity))
  }, [gadget, position.x, position.y, size.width, size.height, visible, opacity, color, borderRadius, borderWidth, borderColor])
  
  return <ConnectedRectGadget 
    gadget={gadget}
    style={style}
    className={className}
    color={color}
    borderRadius={borderRadius}
    borderWidth={borderWidth}
    borderColor={borderColor}
  >
    {children}
  </ConnectedRectGadget>
}

// Connected version that actually uses the gadget system
function ConnectedRectGadget({ 
  gadget, 
  style = {}, 
  className = '', 
  color = '#3b82f6',
  borderRadius = 4,
  borderWidth = 0,
  borderColor = '#000000',
  children 
}: {
  gadget: RectGadget
  style?: CSSProperties
  className?: string
  color?: string
  borderRadius?: number
  borderWidth?: number
  borderColor?: string
  children?: React.ReactNode
}) {
  // Get current values from gadget cells
  const [currentPosition] = useCell(gadget.position)
  const [currentSize] = useCell(gadget.size)
  const [currentVisible] = useCell(gadget.visible)
  const [currentOpacity] = useCell(gadget.opacity)
  
  // Get RectGadget-specific properties
  const [currentBgColor] = useCell(gadget.backgroundColor)
  const [currentBorderRadius] = useCell(gadget.borderRadius)
  const [currentBorderWidth] = useCell(gadget.borderWidth)
  const [currentBorderColor] = useCell(gadget.borderColor)
  
  // Build CSS style from gadget state
  const computedStyle: CSSProperties = {
    position: 'absolute',
    left: currentPosition?.x ?? 0,
    top: currentPosition?.y ?? 0,
    width: currentSize?.width ?? 100,
    height: currentSize?.height ?? 100,
    backgroundColor: currentBgColor || color,
    borderRadius: currentBorderRadius ?? borderRadius,
    borderWidth: currentBorderWidth ?? borderWidth,
    borderColor: currentBorderColor || borderColor,
    borderStyle: (currentBorderWidth ?? borderWidth) > 0 ? 'solid' : 'none',
    opacity: currentOpacity ?? 1,
    display: (currentVisible ?? true) ? 'block' : 'none',
    boxSizing: 'border-box',
    ...style
  }
  
  return (
    <div 
      className={`visual-gadget rect-gadget connected ${className}`}
      style={computedStyle}
      data-gadget-id={gadget.id}
      data-connected="true"
    >
      {children}
    </div>
  )
}

// ============================================================================
// TextGadget React Component
// ============================================================================

interface TextGadgetProps extends BaseVisualProps {
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
  color?: string
  textAlign?: 'left' | 'center' | 'right'
}

export function TextGadgetComponent({
  id = 'text',
  gadget: existingGadget,
  position = { x: 0, y: 0 },
  size = { width: 100, height: 30 },
  visible = true,
  opacity = 1,
  text = 'Text',
  fontSize = 14,
  fontFamily = 'system-ui, sans-serif',
  fontWeight = 'normal',
  color = '#000000',
  textAlign = 'left',
  style = {},
  className = '',
  children
}: TextGadgetProps) {
  // Check if we're in a network context
  const context = React.useContext(NetworkContext)
  
  // If we have an existing gadget, use it
  if (existingGadget) {
    return <ConnectedTextGadget 
      gadget={existingGadget}
      style={style}
      className={className}
      fontSize={fontSize}
      fontFamily={fontFamily}
      fontWeight={fontWeight}
      color={color}
      textAlign={textAlign}
    >
      {children}
    </ConnectedTextGadget>
  }
  
  // If we're in a network context, create a gadget
  if (context) {
    return <AutoCreateTextGadget
      id={id}
      position={position}
      size={size}
      visible={visible}
      opacity={opacity}
      text={text}
      fontSize={fontSize}
      fontFamily={fontFamily}
      fontWeight={fontWeight}
      color={color}
      textAlign={textAlign}
      style={style}
      className={className}
    >
      {children}
    </AutoCreateTextGadget>
  }
  
  // Otherwise, render a static text using just the props
  const computedStyle: CSSProperties = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    width: size.width,
    height: size.height,
    fontSize: fontSize,
    fontFamily: fontFamily,
    fontWeight: fontWeight,
    color: color,
    textAlign: textAlign,
    opacity: opacity,
    display: visible ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start',
    boxSizing: 'border-box',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    ...style
  }
  
  return (
    <div 
      className={`visual-gadget text-gadget static ${className}`}
      style={computedStyle}
      data-gadget-id={id}
      data-static="true"
    >
      {text}
      {children}
    </div>
  )
}

// Auto-create version that creates a text gadget in the network
function AutoCreateTextGadget(props: TextGadgetProps) {
  const { id = 'text', position = { x: 0, y: 0 }, size = { width: 100, height: 30 },
    visible = true, opacity = 1, text = 'Text', fontSize = 14,
    fontFamily = 'system-ui, sans-serif', fontWeight = 'normal',
    color = '#000000', textAlign = 'left', style = {}, className = '', children } = props
  
  // Create the gadget
  const gadget = useGadget(() => {
    const textGadget = new TextGadget(id)
    textGadget.setPosition(position.x, position.y)
    textGadget.setSize(size.width, size.height)
    textGadget.setText(text)
    textGadget.setFontSize(fontSize)
    textGadget.setFontFamily(fontFamily)
    textGadget.setFontWeight(fontWeight)
    textGadget.setColor(color)
    textGadget.setTextAlign(textAlign)
    textGadget.visible.userInput(bool(visible))
    textGadget.opacity.userInput(num(opacity))
    console.log('Created TextGadget:', id, 'with text:', text, 'at position:', position)
    return textGadget
  }, id)
  
  // Update gadget when props change - ESPECIALLY THE TEXT!
  useEffect(() => {
    gadget.setText(text)  // This is crucial for updating the text!
    gadget.setPosition(position.x, position.y)
    gadget.setSize(size.width, size.height)
    gadget.setFontSize(fontSize)
    gadget.setFontFamily(fontFamily)
    gadget.setFontWeight(fontWeight)
    gadget.setColor(color)
    gadget.setTextAlign(textAlign)
    gadget.visible.userInput(bool(visible))
    gadget.opacity.userInput(num(opacity))
  }, [gadget, text, position.x, position.y, size.width, size.height, visible, opacity, fontSize, fontFamily, fontWeight, color, textAlign])
  
  return <ConnectedTextGadget 
    gadget={gadget}
    style={style}
    className={className}
    fontSize={fontSize}
    fontFamily={fontFamily}
    fontWeight={fontWeight}
    color={color}
    textAlign={textAlign}
  >
    {children}
  </ConnectedTextGadget>
}

// Connected version that actually uses the gadget system
function ConnectedTextGadget({ 
  gadget, 
  style = {}, 
  className = '', 
  fontSize = 14,
  fontFamily = 'system-ui, sans-serif',
  fontWeight = 'normal',
  color = '#000000',
  textAlign = 'left',
  children 
}: {
  gadget: TextGadget
  style?: CSSProperties
  className?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
  color?: string
  textAlign?: 'left' | 'center' | 'right'
  children?: React.ReactNode
}) {
  // Get current values from gadget cells
  const [currentPosition] = useCell(gadget.position)
  const [currentSize] = useCell(gadget.size)
  const [currentVisible] = useCell(gadget.visible)
  const [currentOpacity] = useCell(gadget.opacity)
  const [currentText] = useCell(gadget.text)
  
  // Get TextGadget-specific properties
  const [currentFontSize] = useCell(gadget.fontSize)
  const [currentFontFamily] = useCell(gadget.fontFamily)
  const [currentFontWeight] = useCell(gadget.fontWeight)
  const [currentColor] = useCell(gadget.color)
  const [currentTextAlign] = useCell(gadget.textAlign)
  
  // Build CSS style from gadget state
  const computedStyle: CSSProperties = {
    position: 'absolute',
    left: currentPosition?.x ?? 0,
    top: currentPosition?.y ?? 0,
    width: currentSize?.width ?? 100,
    height: currentSize?.height ?? 30,
    fontSize: currentFontSize ?? fontSize,
    fontFamily: currentFontFamily || fontFamily,
    fontWeight: currentFontWeight || fontWeight,
    color: currentColor || color,
    textAlign: (currentTextAlign || textAlign) as any,
    opacity: currentOpacity ?? 1,
    display: (currentVisible ?? true) ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: (currentTextAlign || textAlign) === 'center' ? 'center' : (currentTextAlign || textAlign) === 'right' ? 'flex-end' : 'flex-start',
    boxSizing: 'border-box',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    ...style
  }
  
  return (
    <div 
      className={`visual-gadget text-gadget connected ${className}`}
      style={computedStyle}
      data-gadget-id={gadget.id}
      data-connected="true"
    >
      {currentText ?? 'Text'}
      {children}
    </div>
  )
}

// ============================================================================
// GroupGadget React Component
// ============================================================================

interface GroupGadgetProps extends BaseVisualProps {
  transform?: string
}

export function GroupGadgetComponent({
  id = 'group',
  gadget: existingGadget,
  position = { x: 0, y: 0 },
  size = { width: 200, height: 200 },
  visible = true,
  opacity = 1,
  transform,
  style = {},
  className = '',
  children
}: GroupGadgetProps) {
  // If we have an existing gadget, use it
  if (existingGadget) {
    return <ConnectedGroupGadget 
      gadget={existingGadget}
      style={style}
      className={className}
      transform={transform}
    >
      {children}
    </ConnectedGroupGadget>
  }
  
  // Otherwise, render a static group using just the props
  const computedStyle: CSSProperties = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    width: size.width,
    height: size.height,
    opacity: opacity,
    display: visible ? 'block' : 'none',
    transform: transform,
    ...style
  }
  
  return (
    <div 
      className={`visual-gadget group-gadget static ${className}`}
      style={computedStyle}
      data-gadget-id={id}
      data-static="true"
    >
      {children}
    </div>
  )
}

// Connected version that actually uses the gadget system
function ConnectedGroupGadget({ 
  gadget, 
  style = {}, 
  className = '', 
  transform,
  children 
}: {
  gadget: GroupGadget
  style?: CSSProperties
  className?: string
  transform?: string
  children?: React.ReactNode
}) {
  const network = useNetwork()
  
  // Get current values from gadget cells
  const [currentPosition] = useCell(gadget.position)
  const [currentSize] = useCell(gadget.size)
  const [currentVisible] = useCell(gadget.visible)
  const [currentOpacity] = useCell(gadget.opacity)
  
  // Build CSS style from gadget state
  const computedStyle: CSSProperties = {
    position: 'absolute',
    left: currentPosition?.x ?? 0,
    top: currentPosition?.y ?? 0,
    width: currentSize?.width ?? 200,
    height: currentSize?.height ?? 200,
    opacity: currentOpacity ?? 1,
    display: (currentVisible ?? true) ? 'block' : 'none',
    transform: transform,
    ...style
  }
  
  return (
    <div 
      className={`visual-gadget group-gadget connected ${className}`}
      style={computedStyle}
      data-gadget-id={gadget.id}
      data-connected="true"
    >
      {children}
    </div>
  )
}

// ============================================================================
// Generic VisualGadget Renderer
// ============================================================================

interface VisualGadgetRendererProps {
  gadget: VisualGadget
  style?: CSSProperties
  className?: string
  children?: React.ReactNode
}

/**
 * Generic renderer that can render any VisualGadget
 * This is used by NetworkCanvas to render gadgets from the network
 */
export function VisualGadgetRenderer({ 
  gadget, 
  style = {}, 
  className = '',
  children 
}: VisualGadgetRendererProps) {
  // Determine component type based on gadget
  if (gadget instanceof RectGadget) {
    return (
      <RectGadgetComponent 
        gadget={gadget}
        style={style}
        className={className}
      >
        {children}
      </RectGadgetComponent>
    )
  }
  
  if (gadget instanceof TextGadget) {
    return (
      <TextGadgetComponent 
        gadget={gadget}
        style={style}
        className={className}
      >
        {children}
      </TextGadgetComponent>
    )
  }
  
  if (gadget instanceof GroupGadget) {
    return (
      <GroupGadgetComponent 
        gadget={gadget}
        style={style}
        className={className}
      >
        {children}
      </GroupGadgetComponent>
    )
  }
  
  // Fallback for unknown gadget types
  return (
    <div 
      className={`visual-gadget unknown-gadget ${className}`}
      style={style}
      data-gadget-id={gadget.id}
      data-gadget-type={gadget.constructor.name}
    >
      Unknown gadget type: {gadget.constructor.name}
      {children}
    </div>
  )
}