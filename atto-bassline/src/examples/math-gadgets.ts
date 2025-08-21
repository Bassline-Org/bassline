/**
 * Example math gadgets using the template system
 * These demonstrate the ergonomics of createPrimitive with type safety
 */

import { createPrimitive, type GadgetSchema } from '../templates'

// ============================================================================
// Basic Math Gadget Schemas
// ============================================================================

const AddSchema = {
  inputs: {
    a: { type: 'number', default: 0, description: 'First operand' },
    b: { type: 'number', default: 0, description: 'Second operand' }
  },
  outputs: {
    result: { type: 'number', description: 'Sum of a and b' }
  }
} satisfies GadgetSchema

const MultiplySchema = {
  inputs: {
    a: { type: 'number', default: 1, description: 'First operand' },
    b: { type: 'number', default: 1, description: 'Second operand' }
  },
  outputs: {
    result: { type: 'number', description: 'Product of a and b' }
  }
} satisfies GadgetSchema

const ClampSchema = {
  inputs: {
    value: { type: 'number', default: 0, description: 'Input value to clamp' },
    min: { type: 'number', default: 0, description: 'Minimum allowed value' },
    max: { type: 'number', default: 100, description: 'Maximum allowed value' }
  },
  outputs: {
    clamped: { type: 'number', description: 'Clamped value between min and max' }
  }
} satisfies GadgetSchema

const QuantizeSchema = {
  inputs: {
    value: { type: 'number', default: 0, description: 'Input value to quantize' },
    step: { type: 'number', default: 1, description: 'Quantization step size' }
  },
  outputs: {
    quantized: { type: 'number', description: 'Quantized value' }
  }
} satisfies GadgetSchema

// ============================================================================
// Gadget Template Implementations
// ============================================================================

/**
 * Add two numbers together
 */
export const AddTemplate = createPrimitive(AddSchema, {
  description: 'Adds two numbers together',
  compute: ({ a, b }) => ({
    result: a + b
  })
})

/**
 * Multiply two numbers together
 */
export const MultiplyTemplate = createPrimitive(MultiplySchema, {
  description: 'Multiplies two numbers together',
  compute: ({ a, b }) => ({
    result: a * b
  })
})

/**
 * Clamp a value between min and max bounds
 */
export const ClampTemplate = createPrimitive(ClampSchema, {
  description: 'Clamps a value between minimum and maximum bounds',
  compute: ({ value, min, max }) => ({
    clamped: Math.max(min, Math.min(max, value))
  })
})

/**
 * Quantize a value to discrete steps
 */
export const QuantizeTemplate = createPrimitive(QuantizeSchema, {
  description: 'Quantizes a value to discrete steps',
  compute: ({ value, step }) => ({
    quantized: Math.round(value / step) * step
  })
})

// ============================================================================
// Example Usage and Type Inference Demo
// ============================================================================

/**
 * Demonstrate type-safe template instantiation
 */
export function demonstrateUsage() {
  // Create instances with full type safety
  const adder = AddTemplate.instantiate('my-adder', { a: 5, b: 3 })
  const multiplier = MultiplyTemplate.instantiate('my-multiplier')
  const clamp = ClampTemplate.instantiate('my-clamp', { min: 0, max: 100 })
  
  // TypeScript knows the exact types:
  // adder.inputs.a.value is number
  // adder.outputs.result.value is number
  // clamp.inputs.min.contact is Contact
  
  console.log('Add gadget inputs:', Object.keys(adder.inputs))    // ['a', 'b']
  console.log('Add gadget outputs:', Object.keys(adder.outputs)) // ['result']
  console.log('Clamp default min:', clamp.inputs.min.value)      // 0
  
  return { adder, multiplier, clamp }
}

// ============================================================================
// Advanced Example: Typed Schema from External Type
// ============================================================================

/**
 * Example of creating a schema from an existing TypeScript interface
 */
interface Vector2D {
  x: number
  y: number
}

const Vector2DAddSchema = {
  inputs: {
    a: { type: 'object', description: 'First vector' } as const,
    b: { type: 'object', description: 'Second vector' } as const
  },
  outputs: {
    result: { type: 'object', description: 'Sum vector' } as const
  }
} satisfies GadgetSchema

export const Vector2DAddTemplate = createPrimitive(Vector2DAddSchema, {
  description: 'Adds two 2D vectors together',
  compute: ({ a, b }: { a: Vector2D, b: Vector2D }) => ({
    result: { x: a.x + b.x, y: a.y + b.y } as Vector2D
  })
})