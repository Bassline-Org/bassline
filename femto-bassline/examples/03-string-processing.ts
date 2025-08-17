/**
 * Example 03: String Processing Pipeline
 * Demonstrates string manipulation gadgets and stateful accumulation
 * 
 * This creates a text processing pipeline that:
 * 1. Normalizes input (trim, lowercase)
 * 2. Validates format
 * 3. Extracts parts
 * 4. Accumulates statistics
 */

import { 
  createBoardId, 
  createSlotId, 
  createWireId,
  createGadgetId,
  BoardIR 
} from '../core/types';

import {
  createTrimGadget,
  createLowercaseGadget,
  createSplitGadget,
  createTemplateGadget,
  createStartsWithGadget,
  getStringTransformPinout,
  getStringSplitPinout,
  getStringTestPinout
} from '../stdlib/primitives/string';

import {
  createCountGadget,
  getAccumulatorPinout
} from '../stdlib/primitives/math';

import {
  createAndGadget,
  createConditionalGadget,
  getBinaryLogicPinout,
  getConditionalPinout
} from '../stdlib/primitives/logic';

// ============================================================================
// Create Email Processor Board
// ============================================================================

export function createEmailProcessorBoard(): BoardIR {
  const boardId = createBoardId('email-processor');
  
  return {
    id: boardId,
    
    slots: {
      // String processing chain
      [createSlotId('trimmer')]: {
        requires: getStringTransformPinout().id,
        gadget: createTrimGadget('trim-input').id
      },
      [createSlotId('lowercaser')]: {
        requires: getStringTransformPinout().id,
        gadget: createLowercaseGadget('lowercase-input').id
      },
      [createSlotId('splitter')]: {
        requires: getStringSplitPinout().id,
        gadget: createSplitGadget('split-at-symbol').id
      },
      
      // Validation
      [createSlotId('domain-checker')]: {
        requires: getStringTestPinout().id,
        gadget: createStartsWithGadget('check-domain').id
      },
      
      // Statistics
      [createSlotId('counter')]: {
        requires: getAccumulatorPinout().id,
        gadget: createCountGadget('email-counter').id
      },
      
      // Boundaries
      [createSlotId('email-in')]: {
        requires: createPinoutId('value-io')
      },
      [createSlotId('valid-out')]: {
        requires: createPinoutId('value-io')
      },
      [createSlotId('stats-out')]: {
        requires: createPinoutId('value-io')
      }
    },
    
    wires: {
      // Processing chain: trim -> lowercase -> split
      [createWireId('in-to-trim')]: {
        from: { slot: createSlotId('email-in'), pin: 'out' },
        to: { slot: createSlotId('trimmer'), pin: 'value' }
      },
      [createWireId('trim-to-lower')]: {
        from: { slot: createSlotId('trimmer'), pin: 'result' },
        to: { slot: createSlotId('lowercaser'), pin: 'value' }
      },
      [createWireId('lower-to-split')]: {
        from: { slot: createSlotId('lowercaser'), pin: 'result' },
        to: { slot: createSlotId('splitter'), pin: 'value' }
      },
      
      // Count all processed emails
      [createWireId('lower-to-counter')]: {
        from: { slot: createSlotId('lowercaser'), pin: 'result' },
        to: { slot: createSlotId('counter'), pin: 'value' }
      },
      
      // Output connections
      [createWireId('split-to-valid')]: {
        from: { slot: createSlotId('splitter'), pin: 'result' },
        to: { slot: createSlotId('valid-out'), pin: 'in' }
      },
      [createWireId('counter-to-stats')]: {
        from: { slot: createSlotId('counter'), pin: 'state' },
        to: { slot: createSlotId('stats-out'), pin: 'in' }
      }
    },
    
    aspects: {}
  };
}

// ============================================================================
// Create Template Processing Example
// ============================================================================

export function demonstrateTemplateProcessing() {
  console.log('=== Template Processing ===\n');
  
  // Create a template gadget
  const template = createTemplateGadget(
    'greeting-template',
    'Hello {{name}}, welcome to {{place}}!'
  );
  
  // Process with different inputs
  const inputs1 = { name: 'Alice', place: 'Wonderland' };
  const result1 = template.process(inputs1);
  console.log('Template: "Hello {{name}}, welcome to {{place}}!"');
  console.log('Inputs:', inputs1);
  console.log('Output:', result1);
  console.log();
  
  const inputs2 = { name: 'Bob', place: 'the Matrix' };
  const result2 = template.process(inputs2);
  console.log('Inputs:', inputs2);
  console.log('Output:', result2);
  console.log();
}

// ============================================================================
// Process Sample Emails
// ============================================================================

export function processSampleEmails() {
  console.log('=== Processing Sample Emails ===\n');
  
  // Create processing gadgets
  const trimmer = createTrimGadget('trim');
  const lowercaser = createLowercaseGadget('lower');
  const splitter = createSplitGadget('split');
  const counter = createCountGadget('count');
  
  // Sample emails with various issues
  const emails = [
    '  Alice@Example.com  ',
    'BOB@GMAIL.COM',
    'charlie@yahoo.com',
    '  Dave@Hotmail.COM  ',
    'eve@proton.me'
  ];
  
  console.log('Processing emails through normalization pipeline:\n');
  
  const processed = emails.map(email => {
    console.log(`Input: "${email}"`);
    
    // Process through chain
    const trimmed = trimmer.process({ value: email });
    console.log(`  → Trimmed: "${trimmed}"`);
    
    const lowered = lowercaser.process({ value: trimmed });
    console.log(`  → Lowercased: "${lowered}"`);
    
    const parts = splitter.process({ 
      value: lowered,
      delimiter: '@'
    });
    console.log(`  → Split: [${parts}]`);
    
    // Update counter
    counter.process({ value: lowered });
    
    console.log();
    return { original: email, normalized: lowered, parts };
  });
  
  console.log(`Total emails processed: ${counter.getState()}`);
  console.log();
  
  return processed;
}

// ============================================================================
// Demonstrate Conditional Processing
// ============================================================================

export function demonstrateConditionalLogic() {
  console.log('=== Conditional String Processing ===\n');
  
  // Create logic gadgets
  const startsWith = createStartsWithGadget('starts');
  const conditional = createConditionalGadget('cond');
  
  // Test data
  const testCases = [
    { email: 'admin@company.com', allowedDomain: 'admin' },
    { email: 'user@company.com', allowedDomain: 'admin' },
    { email: 'support@company.com', allowedDomain: 'support' }
  ];
  
  console.log('Conditional routing based on email prefix:\n');
  
  testCases.forEach(({ email, allowedDomain }) => {
    // Check if email starts with allowed domain
    const isAllowed = startsWith.process({
      value: email,
      pattern: allowedDomain
    });
    
    // Route based on condition
    const result = conditional.process({
      condition: isAllowed,
      whenTrue: 'PRIORITY',
      whenFalse: 'NORMAL'
    });
    
    console.log(`Email: ${email}`);
    console.log(`  Checking prefix: "${allowedDomain}"`);
    console.log(`  Matches: ${isAllowed}`);
    console.log(`  Queue: ${result}`);
    console.log();
  });
}

// ============================================================================
// Run the Example
// ============================================================================

export async function runStringProcessingExample() {
  console.log('=== String Processing Pipeline Example ===\n');
  
  // Create the email processor board
  const board = createEmailProcessorBoard();
  console.log('Created email processor with:');
  console.log(`- ${Object.keys(board.slots).length} slots`);
  console.log(`- ${Object.keys(board.wires).length} wires`);
  console.log();
  
  // Demonstrate template processing
  demonstrateTemplateProcessing();
  
  // Process sample emails
  const processedEmails = processSampleEmails();
  
  // Demonstrate conditional logic
  demonstrateConditionalLogic();
  
  // Summary
  console.log('=== Summary ===\n');
  console.log('String gadgets demonstrated:');
  console.log('- Transform: trim, lowercase, capitalize, reverse');
  console.log('- Extract: split, substring, indexOf');
  console.log('- Test: startsWith, endsWith, includes, matches');
  console.log('- Template: variable substitution');
  console.log('- Conditional: routing based on string tests');
  console.log();
  
  return { board, processedEmails };
}

// ============================================================================
// Main Entry Point
// ============================================================================

if (require.main === module) {
  runStringProcessingExample()
    .then(() => {
      console.log('✅ Example completed successfully');
    })
    .catch(error => {
      console.error('❌ Example failed:', error);
      process.exit(1);
    });
}