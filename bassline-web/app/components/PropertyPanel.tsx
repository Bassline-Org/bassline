import { useState, useEffect, useRef } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import { Interval, Color, Temperature, SetValue, ConsensusBoolean, Point2D, ExactString } from '~/propagation-core/types/mergeable'
import { useContactSelection } from '~/propagation-react/hooks/useContactSelection'
import { useContact } from '~/propagation-react/hooks/useContact'

interface PropertyPanelProps {
  isVisible: boolean
  onToggleVisibility: () => void
  shouldFocus: React.MutableRefObject<boolean>
}

type ValueType = 'number' | 'string' | 'interval' | 'color' | 'temperature' | 'boolean' | 'point2d' | 'exactString' | 'set'

export function PropertyPanel({ isVisible, onToggleVisibility, shouldFocus }: PropertyPanelProps) {
  const { selectedContacts } = useContactSelection()
  const valueInputRef = useRef<HTMLInputElement>(null)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const contactData = useContact(selectedContactId)
  const [valueType, setValueType] = useState<ValueType>('string')
  const [tempValue, setTempValue] = useState<any>(null)
  
  // Track selected contact
  useEffect(() => {
    if (selectedContacts.length === 1) {
      const contactId = selectedContacts[0].id
      setSelectedContactId(contactId)
      
      // Focus input only when opened via double-click
      if (isVisible && shouldFocus.current) {
        setTimeout(() => {
          valueInputRef.current?.focus()
          valueInputRef.current?.select()
          shouldFocus.current = false // Reset the flag
        }, 100)
      }
    } else {
      setSelectedContactId(null)
    }
  }, [selectedContacts, isVisible])
  
  // Detect value type from current content
  useEffect(() => {
    if (!contactData.contact) return
    
    const content = contactData.content
    if (content === undefined || content === null) {
      setValueType('string')
    } else if (content instanceof Interval) {
      setValueType('interval')
      setTempValue({ min: content.min, max: content.max })
    } else if (content instanceof Color) {
      setValueType('color')
      setTempValue({ r: content.r, g: content.g, b: content.b })
    } else if (content instanceof Temperature) {
      setValueType('temperature')
      setTempValue(content.celsius)
    } else if (content instanceof ConsensusBoolean) {
      setValueType('boolean')
      setTempValue(content.value)
    } else if (content instanceof Point2D) {
      setValueType('point2d')
      setTempValue({ x: content.x, y: content.y })
    } else if (content instanceof ExactString) {
      setValueType('exactString')
      setTempValue(content.value)
    } else if (content instanceof SetValue) {
      setValueType('set')
      setTempValue(content.toArray().join(', '))
    } else if (typeof content === 'number') {
      setValueType('number')
      setTempValue(content)
    } else {
      setValueType('string')
      setTempValue(String(content))
    }
  }, [contactData.contact, contactData.content])
  
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
        newValue = new SetValue(items)
        break
      default:
        newValue = tempValue
    }
    
    contactData.setContent(newValue)
  }
  
  if (!isVisible) {
    return (
      <div className="fixed left-0 top-1/2 -translate-y-1/2 z-50">
        <Button
          onClick={onToggleVisibility}
          size="sm"
          className="rounded-r-md rounded-l-none"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    )
  }
  
  return (
    <div className="fixed left-0 top-0 h-full w-80 bg-white border-r shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Properties
          </h3>
          <Button
            onClick={onToggleVisibility}
            size="sm"
            variant="ghost"
            className="p-1"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!contactData.contact ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            Select a single contact to edit its properties
          </div>
        ) : (
          <div className="space-y-4">
            {/* Contact Info */}
            <div className="text-xs text-muted-foreground">
              {contactData.isBoundary ? 'Boundary Contact' : 'Contact'}
              {contactData.name && ` - ${contactData.name}`}
            </div>
            
            {/* Blend Mode */}
            <div className="flex items-center justify-between">
              <Label htmlFor="blend-mode" className="text-sm">Merge Mode</Label>
              <Switch
                id="blend-mode"
                checked={contactData.blendMode === 'merge'}
                onCheckedChange={(checked) => {
                  contactData.setBlendMode(checked ? 'merge' : 'accept-last')
                }}
              />
            </div>
            
            {/* Value Type Selector */}
            <div className="space-y-2">
              <Label className="text-sm">Value Type</Label>
              <Select value={valueType} onValueChange={(v) => setValueType(v as ValueType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="interval">Interval</SelectItem>
                  <SelectItem value="color">Color</SelectItem>
                  <SelectItem value="temperature">Temperature</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="point2d">Point 2D</SelectItem>
                  <SelectItem value="exactString">Exact String</SelectItem>
                  <SelectItem value="set">Set</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Value Input */}
            <div className="space-y-2">
              <Label className="text-sm">Value</Label>
              
              {valueType === 'number' && (
                <Input
                  ref={valueInputRef}
                  type="number"
                  value={tempValue || ''}
                  onChange={(e) => setTempValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                />
              )}
              
              {valueType === 'string' && (
                <Input
                  ref={valueInputRef}
                  type="text"
                  value={tempValue || ''}
                  onChange={(e) => setTempValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                />
              )}
              
              {valueType === 'interval' && (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={tempValue?.min || ''}
                    onChange={(e) => setTempValue({ ...tempValue, min: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={tempValue?.max || ''}
                    onChange={(e) => setTempValue({ ...tempValue, max: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                  />
                </div>
              )}
              
              {valueType === 'color' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="R"
                      min="0"
                      max="255"
                      value={tempValue?.r || ''}
                      onChange={(e) => setTempValue({ ...tempValue, r: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                    />
                    <Input
                      type="number"
                      placeholder="G"
                      min="0"
                      max="255"
                      value={tempValue?.g || ''}
                      onChange={(e) => setTempValue({ ...tempValue, g: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                    />
                    <Input
                      type="number"
                      placeholder="B"
                      min="0"
                      max="255"
                      value={tempValue?.b || ''}
                      onChange={(e) => setTempValue({ ...tempValue, b: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                    />
                  </div>
                  <div 
                    className="h-8 rounded border"
                    style={{ backgroundColor: tempValue ? `rgb(${tempValue.r || 0}, ${tempValue.g || 0}, ${tempValue.b || 0})` : '#000' }}
                  />
                </div>
              )}
              
              {valueType === 'temperature' && (
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    value={tempValue || ''}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={applyValue}
                    onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                  />
                  <span className="text-sm">°C</span>
                </div>
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
              
              {valueType === 'point2d' && (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="X"
                    value={tempValue?.x || ''}
                    onChange={(e) => setTempValue({ ...tempValue, x: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                  />
                  <Input
                    type="number"
                    placeholder="Y"
                    value={tempValue?.y || ''}
                    onChange={(e) => setTempValue({ ...tempValue, y: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                  />
                </div>
              )}
              
              {valueType === 'exactString' && (
                <Input
                  type="text"
                  value={tempValue || ''}
                  onChange={(e) => setTempValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                />
              )}
              
              {valueType === 'set' && (
                <Input
                  type="text"
                  placeholder="Comma-separated values"
                  value={tempValue || ''}
                  onChange={(e) => setTempValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyValue()}
                />
              )}
            </div>
            
            {/* Apply Button */}
            <Button
              onClick={applyValue}
              size="sm"
              className="w-full cursor-pointer"
              type="button"
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
    </div>
  )
}