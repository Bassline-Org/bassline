import type { ControlConfig } from 'port-graphs/sugar/controls';

/**
 * Generate smart default controls based on gadget type and current value
 */
export function generateDefaultControls(gadget: any): ControlConfig[] {
  const current = gadget.current();
  const type = gadget.metadata?.get?.('ui/type')?.current();
  const metaType = gadget.metadata?.get?.('meta/type')?.current();

  // Check explicit metadata first
  const explicitControls = gadget.metadata?.get?.('ui/controls')?.current();
  if (explicitControls) {
    return explicitControls;
  }

  const controls: ControlConfig[] = [];

  // Type-specific defaults
  if (typeof current === 'number') {
    controls.push(
      { type: 'button', label: '+1', input: (c: number) => c + 1, size: 'sm' },
      { type: 'button', label: '-1', input: (c: number) => c - 1, size: 'sm', variant: 'outline' },
      { type: 'button', label: '+10', input: (c: number) => c + 10, size: 'sm', variant: 'secondary' },
      { type: 'number', label: 'Set value', placeholder: 'Enter number...' }
    );

    // Max/Min specific controls
    if (type === 'max' || metaType === 'max') {
      controls.push(
        { type: 'button', label: 'Reset', input: 0, variant: 'destructive', size: 'sm' }
      );
    } else if (type === 'min' || metaType === 'min') {
      controls.push(
        { type: 'button', label: 'Reset', input: 100, variant: 'destructive', size: 'sm' }
      );
    }
  }

  if (typeof current === 'string') {
    controls.push(
      { type: 'text', label: 'Set text', placeholder: 'Enter text...' },
      { type: 'button', label: 'Clear', input: '', variant: 'outline', size: 'sm' }
    );
  }

  if (typeof current === 'boolean') {
    controls.push(
      { type: 'toggle', label: 'Toggle', labelOn: 'On', labelOff: 'Off' },
      { type: 'button', label: 'True', input: true, size: 'sm' },
      { type: 'button', label: 'False', input: false, size: 'sm', variant: 'outline' }
    );
  }

  if (current instanceof Set) {
    controls.push(
      { type: 'text', label: 'Add item', placeholder: 'Enter value to add...' },
      { type: 'button', label: 'Clear all', input: new Set(), variant: 'destructive', size: 'sm' }
    );
  }

  if (Array.isArray(current)) {
    controls.push(
      { type: 'text', label: 'Add item', placeholder: 'Enter value...' },
      { type: 'button', label: 'Clear', input: [], variant: 'outline', size: 'sm' }
    );
  }

  if (current && typeof current === 'object' && !Array.isArray(current) && !(current instanceof Set)) {
    // Object/table - offer JSON editor
    controls.push(
      { type: 'json', label: 'Edit JSON', placeholder: '{}' },
      { type: 'button', label: 'Clear', input: {}, variant: 'outline', size: 'sm' }
    );
  }

  // If no specific controls, offer generic JSON input
  if (controls.length === 0) {
    controls.push(
      { type: 'json', label: 'Send value', placeholder: 'Enter value...' }
    );
  }

  return controls;
}

/**
 * Get control presets from metadata
 */
export function getControlPresets(gadget: any) {
  return gadget.metadata?.get?.('ui/presets')?.current() || [];
}

/**
 * Check if gadget metadata explicitly hides default controls
 */
export function shouldShowDefaults(gadget: any): boolean {
  const controlMeta = gadget.metadata?.get?.('ui/control-metadata')?.current();
  return controlMeta?.showDefaults !== false;
}
