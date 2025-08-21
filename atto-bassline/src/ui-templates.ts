/**
 * UI Primitive Templates for React components
 * These define the gadget structure for common UI elements
 */

import { primitive, type Template } from './templates-v2'

// ============================================================================
// Button Template
// ============================================================================

export const ButtonTemplate = primitive(
  {
    inputs: {
      text: { type: 'string', default: 'Button' },
      enabled: { type: 'boolean', default: true }
    },
    outputs: {
      clicked: { type: 'boolean' },
      clickCount: { type: 'number' },
      lastClickTime: { type: 'number' }
    }
  },
  ({ text, enabled }) => {
    // This compute function is called when the button is clicked
    // In practice, the React component will handle this
    return {}
  },
  'Button UI component'
)

// ============================================================================
// Slider Template
// ============================================================================

export const SliderTemplate = primitive(
  {
    inputs: {
      value: { type: 'number', default: 50 },
      min: { type: 'number', default: 0 },
      max: { type: 'number', default: 100 },
      step: { type: 'number', default: 1 },
      enabled: { type: 'boolean', default: true }
    },
    outputs: {
      isDragging: { type: 'boolean' },
      normalizedValue: { type: 'number' } // 0-1 range
    }
  },
  ({ value, min, max }) => ({
    normalizedValue: (value - min) / (max - min)
  }),
  'Slider UI component'
)

// ============================================================================
// TextField Template
// ============================================================================

export const TextFieldTemplate = primitive(
  {
    inputs: {
      text: { type: 'string', default: '' },
      placeholder: { type: 'string', default: 'Enter text...' },
      maxLength: { type: 'number', default: 100 },
      enabled: { type: 'boolean', default: true },
      validation: { type: 'string', default: '.*' } // Regex pattern
    },
    outputs: {
      isFocused: { type: 'boolean' },
      isValid: { type: 'boolean' },
      length: { type: 'number' }
    }
  },
  ({ text, validation }) => {
    const regex = new RegExp(validation)
    return {
      isValid: regex.test(text),
      length: text.length
    }
  },
  'Text field UI component'
)

// ============================================================================
// Panel Template
// ============================================================================

export const PanelTemplate = primitive(
  {
    inputs: {
      x: { type: 'number', default: 0 },
      y: { type: 'number', default: 0 },
      width: { type: 'number', default: 200 },
      height: { type: 'number', default: 150 },
      visible: { type: 'boolean', default: true },
      zIndex: { type: 'number', default: 0 },
      title: { type: 'string', default: 'Panel' }
    },
    outputs: {
      isResizing: { type: 'boolean' },
      isDragging: { type: 'boolean' },
      hasFocus: { type: 'boolean' }
    }
  },
  () => ({}),
  'Panel/Window UI component'
)

// ============================================================================
// Toggle Template
// ============================================================================

export const ToggleTemplate = primitive(
  {
    inputs: {
      checked: { type: 'boolean', default: false },
      enabled: { type: 'boolean', default: true },
      label: { type: 'string', default: '' }
    },
    outputs: {
      toggled: { type: 'boolean' } // Emits when toggled
    }
  },
  ({ checked }) => ({ toggled: checked }),
  'Toggle/Checkbox UI component'
)

// ============================================================================
// Select Template
// ============================================================================

export const SelectTemplate = primitive(
  {
    inputs: {
      value: { type: 'string', default: '' },
      options: { type: 'array', default: [] },
      enabled: { type: 'boolean', default: true }
    },
    outputs: {
      selectedIndex: { type: 'number' },
      isOpen: { type: 'boolean' }
    }
  },
  ({ value, options }) => ({
    selectedIndex: Array.isArray(options) ? options.indexOf(value) : -1
  }),
  'Select/Dropdown UI component'
)

// ============================================================================
// Complex UI Templates (Composed)
// ============================================================================

/**
 * Color Picker - composed of multiple sliders
 */
export const ColorPickerTemplate: Template = {
  components: [
    { id: 'red', template: SliderTemplate },
    { id: 'green', template: SliderTemplate },
    { id: 'blue', template: SliderTemplate },
    {
      id: 'combiner',
      template: primitive(
        {
          inputs: {
            r: { type: 'number' },
            g: { type: 'number' },
            b: { type: 'number' }
          },
          outputs: {
            hex: { type: 'string' },
            rgb: { type: 'string' }
          }
        },
        ({ r, g, b }) => ({
          hex: `#${Math.floor(r).toString(16).padStart(2, '0')}${Math.floor(g).toString(16).padStart(2, '0')}${Math.floor(b).toString(16).padStart(2, '0')}`,
          rgb: `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`
        }),
        'RGB to color string converter'
      )
    }
  ],
  connections: [
    { from: 'red.value', to: 'combiner.r' },
    { from: 'green.value', to: 'combiner.g' },
    { from: 'blue.value', to: 'combiner.b' }
  ],
  expose: {
    inputs: {
      red: 'red.value',
      green: 'green.value',
      blue: 'blue.value'
    },
    outputs: {
      hex: 'combiner.hex',
      rgb: 'combiner.rgb'
    }
  },
  description: 'RGB color picker'
}

/**
 * Range Slider - two sliders for min/max selection
 */
export const RangeSliderTemplate: Template = {
  components: [
    { id: 'min', template: SliderTemplate },
    { id: 'max', template: SliderTemplate },
    {
      id: 'constraint',
      template: primitive(
        {
          inputs: {
            minValue: { type: 'number' },
            maxValue: { type: 'number' }
          },
          outputs: {
            validMin: { type: 'number' },
            validMax: { type: 'number' },
            range: { type: 'number' }
          }
        },
        ({ minValue, maxValue }) => ({
          validMin: minValue,
          validMax: Math.max(minValue, maxValue),
          range: Math.max(0, maxValue - minValue)
        }),
        'Range constraint enforcer'
      )
    }
  ],
  connections: [
    { from: 'min.value', to: 'constraint.minValue' },
    { from: 'max.value', to: 'constraint.maxValue' }
  ],
  expose: {
    inputs: {
      min: 'min.value',
      max: 'max.value',
      lowerBound: 'min.min',
      upperBound: 'max.max'
    },
    outputs: {
      validMin: 'constraint.validMin',
      validMax: 'constraint.validMax',
      range: 'constraint.range'
    }
  },
  description: 'Range selection with min/max sliders'
}

/**
 * Form Field - text input with validation feedback
 */
export const FormFieldTemplate: Template = {
  components: [
    { id: 'input', template: TextFieldTemplate },
    { id: 'label', template: primitive(
      {
        inputs: {
          text: { type: 'string', default: 'Field Label' },
          required: { type: 'boolean', default: false }
        },
        outputs: {
          displayText: { type: 'string' }
        }
      },
      ({ text, required }) => ({
        displayText: required ? `${text} *` : text
      }),
      'Form field label'
    )},
    { id: 'validator', template: primitive(
      {
        inputs: {
          value: { type: 'string' },
          required: { type: 'boolean' },
          minLength: { type: 'number', default: 0 },
          maxLength: { type: 'number', default: 100 }
        },
        outputs: {
          isValid: { type: 'boolean' },
          errorMessage: { type: 'string' }
        }
      },
      ({ value, required, minLength, maxLength }) => {
        if (required && !value) {
          return { isValid: false, errorMessage: 'This field is required' }
        }
        if (value.length < minLength) {
          return { isValid: false, errorMessage: `Minimum ${minLength} characters` }
        }
        if (value.length > maxLength) {
          return { isValid: false, errorMessage: `Maximum ${maxLength} characters` }
        }
        return { isValid: true, errorMessage: '' }
      },
      'Form field validator'
    )}
  ],
  connections: [
    { from: 'input.text', to: 'validator.value' }
  ],
  expose: {
    inputs: {
      label: 'label.text',
      required: 'label.required',
      placeholder: 'input.placeholder',
      value: 'input.text',
      minLength: 'validator.minLength',
      maxLength: 'validator.maxLength'
    },
    outputs: {
      isValid: 'validator.isValid',
      errorMessage: 'validator.errorMessage',
      isFocused: 'input.isFocused'
    }
  },
  description: 'Form field with validation'
}