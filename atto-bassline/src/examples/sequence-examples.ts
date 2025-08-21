/**
 * Examples demonstrating the sequence combinator
 */

import { sequence } from '../templates'
import { AddTemplate, MultiplyTemplate, ClampTemplate } from './math-gadgets'

// ============================================================================
// Simple Sequence Examples
// ============================================================================

/**
 * Create a template that adds 5 then multiplies by 2
 * Input: value → Add 5 → Multiply by 2 → Output: result
 */
export const AddThenMultiplyTemplate = sequence(
  AddTemplate,
  MultiplyTemplate,
  { result: 'a' }  // Map 'result' output to 'a' input
)

/**
 * Create a template that multiplies by 3 then clamps to 0-100
 * Input: value → Multiply by 3 → Clamp 0-100 → Output: clamped
 */
export const MultiplyThenClampTemplate = sequence(
  MultiplyTemplate,
  ClampTemplate,
  { result: 'value' }  // Map 'result' output to 'value' input
)

// ============================================================================
// Three-Stage Pipeline
// ============================================================================

/**
 * Create a three-stage pipeline: Add → Multiply → Clamp
 * This demonstrates chaining sequence calls
 */
export const ThreeStageTemplate = sequence(
  AddThenMultiplyTemplate,
  ClampTemplate,
  { result: 'value' }
)

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Demonstrate sequence template usage
 */
export function demonstrateSequence() {
  // Create a simple add-then-multiply pipeline
  const pipeline = AddThenMultiplyTemplate.instantiate('demo-pipeline', {
    a: 10,  // Will add 10 to input
    b: 3    // Will multiply by 3
  })
  
  console.log('Pipeline inputs:', Object.keys(pipeline.inputs))
  console.log('Pipeline outputs:', Object.keys(pipeline.outputs))
  
  // The sequence should:
  // 1. Take inputs for the Add template (a, b)
  // 2. Expose outputs from the Multiply template (result)
  // 3. Wire Add.result → Multiply.a automatically
  
  return pipeline
}

/**
 * Demonstrate three-stage pipeline
 */
export function demonstrateThreeStage() {
  const pipeline = ThreeStageTemplate.instantiate('three-stage', {
    // First stage (Add) parameters
    a: 5,
    b: 10,
    // Second stage (Multiply) parameter b 
    // (a gets wired from first stage)
    // Third stage (Clamp) parameters
    min: 0,
    max: 100
  })
  
  // This pipeline should:
  // Input → Add 10 → Multiply by 3 → Clamp 0-100 → Output
  // So input of 20 becomes: 20 + 10 = 30, 30 * 3 = 90, clamp(90, 0, 100) = 90
  
  return pipeline
}