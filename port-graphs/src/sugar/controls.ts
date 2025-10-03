/**
 * Control Schema - Metadata-driven UI controls for gadgets
 *
 * Gadgets can declare what controls they want via ui/controls metadata.
 * This enables automatic UI generation for any gadget.
 */

/**
 * A single control configuration
 */
export type ControlConfig =
  | ButtonControl
  | NumberControl
  | TextControl
  | SliderControl
  | ToggleControl
  | SelectControl
  | JsonControl;

/**
 * Button that sends a value when clicked
 */
export interface ButtonControl {
  type: 'button';
  label: string;
  icon?: string;
  /** Value to send, or function to compute value from current state */
  input: any | ((current: any) => any);
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * Number input field
 */
export interface NumberControl {
  type: 'number';
  label: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Text input field
 */
export interface TextControl {
  type: 'text';
  label: string;
  placeholder?: string;
  validation?: (val: string) => boolean;
}

/**
 * Slider for numeric values
 */
export interface SliderControl {
  type: 'slider';
  label?: string;
  min: number;
  max: number;
  step?: number;
}

/**
 * Toggle/checkbox for boolean values
 */
export interface ToggleControl {
  type: 'toggle';
  label?: string;
  labelOn?: string;
  labelOff?: string;
}

/**
 * Dropdown select
 */
export interface SelectControl {
  type: 'select';
  label: string;
  placeholder?: string;
  options: Array<{ label: string; value: any; icon?: string }>;
}

/**
 * JSON editor for complex objects
 */
export interface JsonControl {
  type: 'json';
  label: string;
  schema?: object; // JSON schema for validation
  placeholder?: string;
}

/**
 * A preset value that can be quickly applied
 */
export interface ControlPreset {
  label: string;
  icon?: string;
  input: any;
  description?: string;
}

/**
 * Full control metadata for a gadget
 */
export interface ControlMetadata {
  /** Primary controls to display */
  controls?: ControlConfig[];
  /** Quick preset values */
  presets?: ControlPreset[];
  /** Whether to show auto-generated defaults */
  showDefaults?: boolean;
  /** Keyboard shortcuts */
  shortcuts?: Record<string, any>; // key combo -> input value
}
