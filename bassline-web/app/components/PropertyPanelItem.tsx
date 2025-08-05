import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Interval, Color, Temperature, SetValue, ConsensusBoolean, Point2D, ExactString } from '~/propagation-core/types/mergeable'
import { useContact } from '~/propagation-react/hooks/useContact'
import { useGroup } from '~/propagation-react/hooks/useGroup'
import { cn } from '~/lib/utils'

type ValueType = 'number' | 'string' | 'interval' | 'color' | 'temperature' | 'boolean' | 'point2d' | 'exactString' | 'set' | 'map' | 'date' | 'object' | 'array'

interface ContactPropertySectionProps {
  contactId: string
  isExpanded: boolean
  onToggle: () => void
  isFocused: boolean
  hideToggle?: boolean
  onSetDirty?: (dirty: boolean) => void
  onSetFocused?: (focused: boolean) => void
  itemKey?: string
}

export function ContactPropertySection({ contactId, isExpanded, onToggle, isFocused, hideToggle = false, onSetDirty, onSetFocused, itemKey }: ContactPropertySectionProps) {
  const contactData = useContact(contactId)
  const [valueType, setValueType] = useState<ValueType>('string')
  const [tempValue, setTempValue] = useState<any>(null)
  const valueInputRef = useRef<HTMLInputElement>(null)
  const [originalValue, setOriginalValue] = useState<any>(null)
  const [hasValueChanged, setHasValueChanged] = useState(false)
  const [localIsFocused, setLocalIsFocused] = useState(false)
  
  // Use a stable key for this component instance
  const stableKey = itemKey || contactId

  // Detect value type from current content
  useEffect(() => {
    if (!contactData.contact) return
    
    const content = contactData.content
    let value: any
    
    if (content === undefined || content === null) {
      setValueType('string')
      value = ''
    } else if (content instanceof Interval) {
      setValueType('interval')
      value = { min: content.min, max: content.max }
    } else if (content instanceof Color) {
      setValueType('color')
      value = { r: content.r, g: content.g, b: content.b }
    } else if (content instanceof Temperature) {
      setValueType('temperature')
      value = content.celsius
    } else if (content instanceof ConsensusBoolean) {
      setValueType('boolean')
      value = content.value
    } else if (content instanceof Point2D) {
      setValueType('point2d')
      value = { x: content.x, y: content.y }
    } else if (content instanceof ExactString) {
      setValueType('exactString')
      value = content.value
    } else if (content instanceof SetValue) {
      setValueType('set')
      value = content.toArray().join(', ')
    } else if (content instanceof Set) {
      setValueType('set')
      value = Array.from(content).join(', ')
    } else if (content instanceof Map) {
      setValueType('map')
      const pairs = Array.from(content.entries()).map(([k, v]) => `${k}:${v}`)
      value = pairs.join(', ')
    } else if (content instanceof Date) {
      setValueType('date')
      value = content.toISOString().split('T')[0]
    } else if (Array.isArray(content)) {
      setValueType('array')
      value = JSON.stringify(content)
    } else if (typeof content === 'number') {
      setValueType('number')
      value = content
    } else if (typeof content === 'boolean') {
      setValueType('boolean')
      value = content
    } else if (typeof content === 'object' && content !== null) {
      setValueType('object')
      value = JSON.stringify(content, null, 2)
    } else {
      setValueType('string')
      value = String(content)
    }
    
    setTempValue(value)
    setOriginalValue(value)
    setHasValueChanged(false)
    onSetDirty?.(false)
  }, [contactData.contact, contactData.content])

  // Check if value has changed
  useEffect(() => {
    const changed = JSON.stringify(tempValue) !== JSON.stringify(originalValue)
    setHasValueChanged(changed)
    // Only update dirty state if we have unsaved changes in the input fields
    if (onSetDirty) {
      onSetDirty(changed)
    }
  }, [tempValue, originalValue, onSetDirty])

  const applyValue = () => {
    if (!contactData.contact) return
    
    let newValue: any
    
    switch (valueType) {
      case 'number':
        newValue = Number(tempValue)
        break
      case 'interval':
        newValue = new Interval(Number(tempValue.min), Number(tempValue.max))
        break
      case 'color':
        newValue = new Color(
          Math.min(255, Math.max(0, Number(tempValue.r))),
          Math.min(255, Math.max(0, Number(tempValue.g))),
          Math.min(255, Math.max(0, Number(tempValue.b)))
        )
        break
      case 'temperature':
        newValue = new Temperature(Number(tempValue))
        break
      case 'boolean':
        newValue = new ConsensusBoolean(Boolean(tempValue))
        break
      case 'point2d':
        newValue = new Point2D(Number(tempValue.x), Number(tempValue.y))
        break
      case 'exactString':
        newValue = new ExactString(String(tempValue))
        break
      case 'set':
        const items = String(tempValue).split(',').map(s => s.trim()).filter(s => s)
        const parsedItems = items.map(item => {
          const num = Number(item)
          return isNaN(num) ? item : num
        })
        newValue = new Set(parsedItems)
        break
      case 'map':
        try {
          const pairs = String(tempValue).split(',').map(s => s.trim()).filter(s => s)
          const map = new Map()
          pairs.forEach(pair => {
            const [key, value] = pair.split(':').map(s => s.trim())
            if (key && value) {
              map.set(key, value)
            }
          })
          newValue = map
        } catch {
          newValue = new Map()
        }
        break
      case 'date':
        newValue = new Date(tempValue)
        break
      case 'array':
        try {
          newValue = JSON.parse(tempValue)
        } catch {
          newValue = []
        }
        break
      case 'object':
        try {
          newValue = JSON.parse(tempValue)
        } catch {
          newValue = {}
        }
        break
      default:
        newValue = tempValue
    }
    
    contactData.setContent(newValue)
    setOriginalValue(tempValue)
    setHasValueChanged(false)
    onSetDirty?.(false)
  }

  if (!contactData.contact) return null

  return (
    <div className={cn(
      "border rounded-lg transition-all bg-gray-700",
      isFocused ? "border-blue-500 shadow-lg" : "border-gray-600",
      !isFocused && "opacity-80"
    )}>
      {/* Header */}
      {hideToggle ? (
        <div className="w-full px-3 py-2 flex items-center justify-between bg-gray-600 rounded-t-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-100">
              {contactData.isBoundary ? '🔌' : '⚪'} {contactData.name || `Contact ${contactId.slice(0, 8)}`}
            </span>
          </div>
          <span className="text-xs text-gray-400">
            {contactData.isBoundary ? 'Boundary' : 'Contact'}
          </span>
        </div>
      ) : (
        <button
          onClick={onToggle}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-600 rounded-t-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-300" /> : <ChevronRight className="w-4 h-4 text-gray-300" />}
            <span className="text-sm font-medium text-gray-100">
              {contactData.isBoundary ? '🔌' : '⚪'} {contactData.name || `Contact ${contactId.slice(0, 8)}`}
            </span>
          </div>
          <span className="text-xs text-gray-400">
            {contactData.isBoundary ? 'Boundary' : 'Contact'}
          </span>
        </button>
      )}

      {/* Content */}
      {isExpanded && (
        <div className="p-3 space-y-3 border-t border-gray-600">
          {/* Blend Mode */}
          <div className="flex items-center justify-between">
            <Label htmlFor={`blend-${contactId}`} className="text-sm text-gray-200">Merge Mode</Label>
            <Switch
              id={`blend-${contactId}`}
              checked={contactData.blendMode === 'merge'}
              onCheckedChange={(checked) => {
                contactData.setBlendMode(checked ? 'merge' : 'accept-last')
                // Don't mark as dirty for immediate property changes
              }}
            />
          </div>
          
          {/* Boundary Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`boundary-${contactId}`} className="text-sm text-gray-200">Boundary Contact</Label>
              <Switch
                id={`boundary-${contactId}`}
                checked={contactData.isBoundary}
                onCheckedChange={(checked) => {
                  contactData.setBoundary(checked)
                  // Don't mark as dirty for immediate property changes
                }}
              />
            </div>
            
            {/* Boundary Direction */}
            {contactData.isBoundary && (
              <div className="space-y-2">
                <Label className="text-sm text-gray-200">Direction</Label>
                <Select 
                  value={contactData.boundaryDirection || 'input'} 
                  onValueChange={(value: 'input' | 'output') => {
                    contactData.setBoundaryDirection(value)
                    // Don't mark as dirty for immediate property changes
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="input">Input</SelectItem>
                    <SelectItem value="output">Output</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          {/* Value Type Selector */}
          <div className="space-y-2">
            <Label className="text-sm text-gray-200">Value Type</Label>
            <Select value={valueType} onValueChange={(v) => setValueType(v as ValueType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="string">String</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="array">Array</SelectItem>
                <SelectItem value="object">Object</SelectItem>
                <SelectItem value="set">Set</SelectItem>
                <SelectItem value="map">Map</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="interval">Interval</SelectItem>
                <SelectItem value="color">Color</SelectItem>
                <SelectItem value="temperature">Temperature</SelectItem>
                <SelectItem value="point2d">Point 2D</SelectItem>
                <SelectItem value="exactString">Exact String</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Value Input */}
          <div className="space-y-2">
            <Label className="text-sm text-gray-200">Value</Label>
            
            {valueType === 'number' && (
              <Input
                ref={valueInputRef}
                type="number"
                value={tempValue || ''}
                onChange={(e) => setTempValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                onFocus={() => {
                  setLocalIsFocused(true)
                  onSetFocused?.(true)
                }}
                onBlur={() => {
                  setLocalIsFocused(false)
                  onSetFocused?.(false)
                }}
                key={`${stableKey}-number-input`}
              />
            )}
            
            {valueType === 'string' && (
              <Input
                ref={valueInputRef}
                type="text"
                value={tempValue || ''}
                onChange={(e) => setTempValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                onFocus={() => {
                  setLocalIsFocused(true)
                  onSetFocused?.(true)
                }}
                onBlur={() => {
                  setLocalIsFocused(false)
                  onSetFocused?.(false)
                }}
              />
            )}
            
            {valueType === 'boolean' && (
              <Switch
                checked={tempValue || false}
                onCheckedChange={(checked) => {
                  setTempValue(checked)
                  contactData.setContent(new ConsensusBoolean(checked))
                }}
              />
            )}
            
            {valueType === 'set' && (
              <Input
                ref={valueInputRef}
                type="text"
                value={tempValue || ''}
                placeholder="comma-separated values"
                onChange={(e) => setTempValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                onFocus={() => {
                  setLocalIsFocused(true)
                  onSetFocused?.(true)
                }}
                onBlur={() => {
                  setLocalIsFocused(false)
                  onSetFocused?.(false)
                }}
              />
            )}
            
            {valueType === 'map' && (
              <Input
                ref={valueInputRef}
                type="text"
                value={tempValue || ''}
                placeholder="key:value, key:value"
                onChange={(e) => setTempValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                onFocus={() => {
                  setLocalIsFocused(true)
                  onSetFocused?.(true)
                }}
                onBlur={() => {
                  setLocalIsFocused(false)
                  onSetFocused?.(false)
                }}
              />
            )}
            
            {valueType === 'array' && (
              <textarea
                ref={valueInputRef as any}
                value={tempValue || ''}
                placeholder="JSON array"
                onChange={(e) => setTempValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && applyValue()}
                onFocus={() => onSetFocused?.(true)}
                onBlur={() => onSetFocused?.(false)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md"
                rows={3}
              />
            )}
            
            {valueType === 'object' && (
              <textarea
                ref={valueInputRef as any}
                value={tempValue || ''}
                placeholder="JSON object"
                onChange={(e) => setTempValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && applyValue()}
                onFocus={() => onSetFocused?.(true)}
                onBlur={() => onSetFocused?.(false)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md"
                rows={4}
              />
            )}
            
            {valueType === 'date' && (
              <Input
                ref={valueInputRef}
                type="date"
                value={tempValue || ''}
                onChange={(e) => setTempValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                onFocus={() => {
                  setLocalIsFocused(true)
                  onSetFocused?.(true)
                }}
                onBlur={() => {
                  setLocalIsFocused(false)
                  onSetFocused?.(false)
                }}
              />
            )}
            
            {valueType === 'interval' && (
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={tempValue?.min || ''}
                  placeholder="min"
                  onChange={(e) => setTempValue({ ...tempValue, min: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                  onFocus={() => onSetFocused?.(true)}
                  onBlur={() => onSetFocused?.(false)}
                />
                <Input
                  type="number"
                  value={tempValue?.max || ''}
                  placeholder="max"
                  onChange={(e) => setTempValue({ ...tempValue, max: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                  onFocus={() => onSetFocused?.(true)}
                  onBlur={() => onSetFocused?.(false)}
                />
              </div>
            )}
            
            {valueType === 'color' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={tempValue?.r || ''}
                    placeholder="R"
                    min="0"
                    max="255"
                    onChange={(e) => setTempValue({ ...tempValue, r: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                    onFocus={() => onSetFocused?.(true)}
                    onBlur={() => onSetFocused?.(false)}
                  />
                  <Input
                    type="number"
                    value={tempValue?.g || ''}
                    placeholder="G"
                    min="0"
                    max="255"
                    onChange={(e) => setTempValue({ ...tempValue, g: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                    onFocus={() => onSetFocused?.(true)}
                    onBlur={() => onSetFocused?.(false)}
                  />
                  <Input
                    type="number"
                    value={tempValue?.b || ''}
                    placeholder="B"
                    min="0"
                    max="255"
                    onChange={(e) => setTempValue({ ...tempValue, b: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                    onFocus={() => onSetFocused?.(true)}
                    onBlur={() => onSetFocused?.(false)}
                  />
                </div>
                {tempValue && (
                  <div 
                    className="h-8 rounded border"
                    style={{ backgroundColor: `rgb(${tempValue.r || 0}, ${tempValue.g || 0}, ${tempValue.b || 0})` }}
                  />
                )}
              </div>
            )}
            
            {valueType === 'temperature' && (
              <div className="flex gap-2 items-center">
                <Input
                  ref={valueInputRef}
                  type="number"
                  value={tempValue || ''}
                  placeholder="celsius"
                  onChange={(e) => setTempValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                  onFocus={() => onSetFocused?.(true)}
                  onBlur={() => onSetFocused?.(false)}
                />
                <span className="text-sm text-gray-400">°C</span>
              </div>
            )}
            
            {valueType === 'point2d' && (
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={tempValue?.x || ''}
                  placeholder="x"
                  onChange={(e) => setTempValue({ ...tempValue, x: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                  onFocus={() => onSetFocused?.(true)}
                  onBlur={() => onSetFocused?.(false)}
                />
                <Input
                  type="number"
                  value={tempValue?.y || ''}
                  placeholder="y"
                  onChange={(e) => setTempValue({ ...tempValue, y: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                  onFocus={() => onSetFocused?.(true)}
                  onBlur={() => onSetFocused?.(false)}
                />
              </div>
            )}
            
            {valueType === 'exactString' && (
              <Input
                ref={valueInputRef}
                type="text"
                value={tempValue || ''}
                placeholder="exact string (no merge)"
                onChange={(e) => setTempValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                onFocus={() => {
                  setLocalIsFocused(true)
                  onSetFocused?.(true)
                }}
                onBlur={() => {
                  setLocalIsFocused(false)
                  onSetFocused?.(false)
                }}
              />
            )}
          </div>
          
          {/* Apply Button */}
          <Button
            onClick={applyValue}
            size="sm"
            className="w-full"
          >
            Apply Value
          </Button>
          
          {/* Contradiction Display */}
          {contactData.lastContradiction && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <div className="font-semibold mb-1">Contradiction</div>
              <div>{contactData.lastContradiction.reason}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface GroupPropertySectionProps {
  groupId: string
  isExpanded: boolean
  onToggle: () => void
  isFocused: boolean
  hideToggle?: boolean
  onSetDirty?: (dirty: boolean) => void
  onSetFocused?: (focused: boolean) => void
}

export function GroupPropertySection({ groupId, isExpanded, onToggle, isFocused, hideToggle = false, onSetDirty, onSetFocused }: GroupPropertySectionProps) {
  const groupData = useGroup(groupId)
  const [originalName, setOriginalName] = useState('')
  const [originalPosition, setOriginalPosition] = useState({ x: 0, y: 0 })
  const [tempName, setTempName] = useState('')
  const [tempPosition, setTempPosition] = useState({ x: 0, y: 0 })

  // Initialize values when group data loads
  useEffect(() => {
    if (groupData.group) {
      setOriginalName(groupData.name)
      setTempName(groupData.name)
      setOriginalPosition({ x: groupData.position.x, y: groupData.position.y })
      setTempPosition({ x: groupData.position.x, y: groupData.position.y })
    }
  }, [groupData.group, groupData.name, groupData.position.x, groupData.position.y])

  // Check if values have changed
  useEffect(() => {
    const nameChanged = tempName !== originalName
    const positionChanged = tempPosition.x !== originalPosition.x || tempPosition.y !== originalPosition.y
    const hasChanged = nameChanged || positionChanged
    onSetDirty?.(hasChanged)
  }, [tempName, tempPosition, originalName, originalPosition, onSetDirty])

  if (!groupData.group) return null

  return (
    <div className={cn(
      "border rounded-lg transition-all bg-gray-700",
      isFocused ? "border-blue-500 shadow-lg" : "border-gray-600",
      !isFocused && "opacity-80"
    )}>
      {/* Header */}
      {hideToggle ? (
        <div className="w-full px-3 py-2 flex items-center justify-between bg-gray-600 rounded-t-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-100">
              📦 {groupData.name || `Gadget ${groupId.slice(0, 8)}`}
            </span>
          </div>
          <span className="text-xs text-gray-400">
            {groupData.isPrimitive ? 'Primitive' : 'Gadget'}
          </span>
        </div>
      ) : (
        <button
          onClick={onToggle}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-600 rounded-t-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-300" /> : <ChevronRight className="w-4 h-4 text-gray-300" />}
            <span className="text-sm font-medium text-gray-100">
              📦 {groupData.name || `Gadget ${groupId.slice(0, 8)}`}
            </span>
          </div>
          <span className="text-xs text-gray-400">
            {groupData.isPrimitive ? 'Primitive' : 'Gadget'}
          </span>
        </button>
      )}

      {/* Content */}
      {isExpanded && (
        <div className="p-3 space-y-3 border-t border-gray-600">
          {/* Gadget Name */}
          <div className="space-y-2">
            <Label htmlFor={`name-${groupId}`} className="text-sm text-gray-200">Name</Label>
            <Input
              id={`name-${groupId}`}
              type="text"
              value={tempName}
              onChange={(e) => {
                setTempName(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  groupData.rename(tempName)
                  setOriginalName(tempName)
                  e.currentTarget.blur()
                }
              }}
              onBlur={() => {
                if (tempName !== originalName) {
                  groupData.rename(tempName)
                  setOriginalName(tempName)
                }
                onSetFocused?.(false)
              }}
              onFocus={() => onSetFocused?.(true)}
            />
          </div>
          
          {/* Gadget Stats */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Inputs:</span>
              <span className="text-gray-200">{groupData.inputContacts.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Outputs:</span>
              <span className="text-gray-200">{groupData.outputContacts.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Internal Contacts:</span>
              <span className="text-gray-200">{groupData.contacts.filter(c => !c.isBoundary).length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Wires:</span>
              <span className="text-gray-200">{groupData.wires.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Sub-gadgets:</span>
              <span className="text-gray-200">{groupData.subgroups.length}</span>
            </div>
          </div>
          
          {/* Navigate Inside */}
          {!groupData.isPrimitive && (
            <Button
              onClick={() => groupData.navigate()}
              size="sm"
              className="w-full"
              variant="outline"
            >
              Navigate Inside
            </Button>
          )}
          
          {/* Position */}
          <div className="space-y-2">
            <Label className="text-sm text-gray-200">Position</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="X"
                value={Math.round(tempPosition.x)}
                onChange={(e) => {
                  setTempPosition({ ...tempPosition, x: Number(e.target.value) })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    groupData.setPosition(tempPosition)
                    setOriginalPosition(tempPosition)
                    e.currentTarget.blur()
                  }
                }}
                onBlur={() => {
                  if (tempPosition.x !== originalPosition.x || tempPosition.y !== originalPosition.y) {
                    groupData.setPosition(tempPosition)
                    setOriginalPosition(tempPosition)
                  }
                  onSetFocused?.(false)
                }}
                onFocus={() => onSetFocused?.(true)}
              />
              <Input
                type="number"
                placeholder="Y"
                value={Math.round(tempPosition.y)}
                onChange={(e) => {
                  setTempPosition({ ...tempPosition, y: Number(e.target.value) })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    groupData.setPosition(tempPosition)
                    setOriginalPosition(tempPosition)
                    e.currentTarget.blur()
                  }
                }}
                onBlur={() => {
                  if (tempPosition.x !== originalPosition.x || tempPosition.y !== originalPosition.y) {
                    groupData.setPosition(tempPosition)
                    setOriginalPosition(tempPosition)
                  }
                  onSetFocused?.(false)
                }}
                onFocus={() => onSetFocused?.(true)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}