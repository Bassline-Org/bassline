import { useState } from 'react';
import type { ControlConfig, ControlPreset } from 'port-graphs/sugar/controls';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Slider } from '~/components/ui/slider';
import { Switch } from '~/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Badge } from '~/components/ui/badge';

interface GadgetControlsProps {
  gadget: any;
  controls: ControlConfig[];
  presets?: ControlPreset[];
  compact?: boolean;
  className?: string;
}

/**
 * Renders interactive controls for a gadget based on control schema
 */
export function GadgetControls({ gadget, controls, presets, compact = false, className = '' }: GadgetControlsProps) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const handleSend = (input: any | ((current: any) => any)) => {
    const value = typeof input === 'function' ? input(gadget.current()) : input;
    gadget.receive(value);
  };

  const handleInputSend = (controlId: string, rawValue: string, control: ControlConfig) => {
    let value: any = rawValue;

    // Type coercion based on control type
    if (control.type === 'number') {
      value = parseFloat(rawValue);
      if (isNaN(value)) return;
      if (control.min !== undefined && value < control.min) value = control.min;
      if (control.max !== undefined && value > control.max) value = control.max;
    } else if (control.type === 'json') {
      try {
        value = JSON.parse(rawValue);
      } catch (e) {
        console.error('Invalid JSON:', e);
        return;
      }
    } else if (control.type === 'text') {
      // String validation
      if (control.validation && !control.validation(rawValue)) {
        return;
      }
    }

    // For Sets, add the item to the current set
    const current = gadget.current();
    if (current instanceof Set && control.type !== 'json') {
      const newSet = new Set(current);
      newSet.add(value);
      gadget.receive(newSet);
    }
    // For arrays, append
    else if (Array.isArray(current) && control.type !== 'json') {
      gadget.receive([...current, value]);
    }
    // Otherwise just set the value
    else {
      gadget.receive(value);
    }

    // Clear input after sending
    setInputValues(prev => ({ ...prev, [controlId]: '' }));
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Presets */}
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {presets.map((preset, i) => (
            <Button
              key={i}
              onClick={() => handleSend(preset.input)}
              variant="outline"
              size="sm"
              className="text-xs"
              title={preset.description}
            >
              {preset.icon && <span className="mr-1">{preset.icon}</span>}
              {preset.label}
            </Button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className={compact ? 'flex flex-wrap gap-1' : 'space-y-2'}>
        {controls.map((control, i) => {
          const controlId = `${control.type}-${i}`;

          // Button control
          if (control.type === 'button') {
            return (
              <Button
                key={controlId}
                onClick={() => handleSend(control.input)}
                variant={control.variant || 'default'}
                size={control.size || 'default'}
                className={compact ? '' : 'w-full'}
              >
                {control.icon && <span className="mr-1">{control.icon}</span>}
                {control.label}
              </Button>
            );
          }

          // Number input
          if (control.type === 'number') {
            return (
              <div key={controlId} className={compact ? 'inline-flex items-center gap-1' : 'space-y-1'}>
                {!compact && <Label className="text-xs">{control.label}</Label>}
                <div className="flex gap-1">
                  <Input
                    type="number"
                    placeholder={control.placeholder || control.label}
                    value={inputValues[controlId] || ''}
                    onChange={(e) => setInputValues(prev => ({ ...prev, [controlId]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleInputSend(controlId, inputValues[controlId] || '', control);
                      }
                    }}
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    className="h-8 text-sm"
                  />
                  <Button
                    onClick={() => handleInputSend(controlId, inputValues[controlId] || '', control)}
                    size="sm"
                    className="h-8"
                  >
                    Set
                  </Button>
                </div>
              </div>
            );
          }

          // Text input
          if (control.type === 'text') {
            return (
              <div key={controlId} className={compact ? 'inline-flex items-center gap-1' : 'space-y-1'}>
                {!compact && <Label className="text-xs">{control.label}</Label>}
                <div className="flex gap-1">
                  <Input
                    type="text"
                    placeholder={control.placeholder || control.label}
                    value={inputValues[controlId] || ''}
                    onChange={(e) => setInputValues(prev => ({ ...prev, [controlId]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleInputSend(controlId, inputValues[controlId] || '', control);
                      }
                    }}
                    className="h-8 text-sm"
                  />
                  <Button
                    onClick={() => handleInputSend(controlId, inputValues[controlId] || '', control)}
                    size="sm"
                    className="h-8"
                  >
                    Add
                  </Button>
                </div>
              </div>
            );
          }

          // Slider
          if (control.type === 'slider') {
            const current = gadget.current();
            const value = typeof current === 'number' ? current : control.min;
            return (
              <div key={controlId} className="space-y-1">
                <div className="flex items-center justify-between">
                  {control.label && <Label className="text-xs">{control.label}</Label>}
                  <Badge variant="outline" className="text-xs">{value}</Badge>
                </div>
                <Slider
                  min={control.min}
                  max={control.max}
                  step={control.step || 1}
                  value={[value]}
                  onValueChange={(vals) => handleSend(vals[0])}
                  className="w-full"
                />
              </div>
            );
          }

          // Toggle/Switch
          if (control.type === 'toggle') {
            const current = gadget.current();
            const checked = typeof current === 'boolean' ? current : false;
            return (
              <div key={controlId} className="flex items-center justify-between">
                <Label className="text-sm">
                  {control.label || (checked ? control.labelOn : control.labelOff) || 'Toggle'}
                </Label>
                <Switch
                  checked={checked}
                  onCheckedChange={(val) => handleSend(val)}
                />
              </div>
            );
          }

          // Select dropdown
          if (control.type === 'select') {
            return (
              <div key={controlId} className="space-y-1">
                <Label className="text-xs">{control.label}</Label>
                <Select onValueChange={(val) => {
                  // Find the actual value from options
                  const option = control.options.find(opt => String(opt.value) === val);
                  if (option) handleSend(option.value);
                }}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder={control.placeholder || 'Select...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {control.options.map((opt, optIdx) => (
                      <SelectItem key={optIdx} value={String(opt.value)}>
                        {opt.icon && <span className="mr-1">{opt.icon}</span>}
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          // JSON editor
          if (control.type === 'json') {
            return (
              <div key={controlId} className="space-y-1">
                <Label className="text-xs">{control.label}</Label>
                <div className="flex gap-1">
                  <Input
                    type="text"
                    placeholder={control.placeholder || '{"key": "value"}'}
                    value={inputValues[controlId] || ''}
                    onChange={(e) => setInputValues(prev => ({ ...prev, [controlId]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.metaKey) {
                        handleInputSend(controlId, inputValues[controlId] || '', control);
                      }
                    }}
                    className="h-8 text-sm font-mono"
                  />
                  <Button
                    onClick={() => handleInputSend(controlId, inputValues[controlId] || '', control)}
                    size="sm"
                    className="h-8"
                  >
                    Send
                  </Button>
                </div>
                <div className="text-xs text-gray-500">Press ⌘Enter to send</div>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
