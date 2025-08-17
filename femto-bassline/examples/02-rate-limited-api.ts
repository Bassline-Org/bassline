/**
 * Example 02: Rate-Limited API Pipeline
 * Demonstrates using shim gadgets for observability and flow control
 * 
 * This creates a pipeline that:
 * 1. Taps incoming requests for monitoring
 * 2. Applies rate limiting
 * 3. Uses credit-based scheduling
 * 4. Taps outgoing responses
 */

import { 
  createBoardId, 
  createSlotId, 
  createWireId,
  createAspectId,
  BoardIR 
} from '../core/types';

import { 
  createTapGadget,
  createTapGadgetSpec 
} from '../stdlib/shims/tap';

import { 
  createRateLimitGadget,
  createRateLimitGadgetSpec 
} from '../stdlib/shims/rate-limit';

import { 
  createCreditGateGadget,
  createCreditGateGadgetSpec 
} from '../stdlib/shims/credit-gate';

import { createBinder } from '../runtime/binder';
import { createDefaultAspectRegistry } from '../runtime/aspects';

// ============================================================================
// Create the API Pipeline Board
// ============================================================================

export function createAPIPipelineBoard(): BoardIR {
  const boardId = createBoardId('api-pipeline');
  
  return {
    id: boardId,
    
    slots: {
      // API endpoint (placeholder - would be actual API handler)
      [createSlotId('api-handler')]: {
        requires: createPinoutId('value-io')
      },
      
      // Input/Output boundaries
      [createSlotId('request-in')]: {
        requires: createPinoutId('value-io')
      },
      [createSlotId('response-out')]: {
        requires: createPinoutId('value-io')
      }
    },
    
    wires: {
      // Main data flow: request -> handler -> response
      [createWireId('request-flow')]: {
        from: {
          slot: createSlotId('request-in'),
          pin: 'out'
        },
        to: {
          slot: createSlotId('api-handler'),
          pin: 'in'
        },
        // Label for aspect targeting
        label: 'main-flow'
      },
      
      [createWireId('response-flow')]: {
        from: {
          slot: createSlotId('api-handler'),
          pin: 'out'
        },
        to: {
          slot: createSlotId('response-out'),
          pin: 'in'
        },
        label: 'main-flow'
      }
    },
    
    // Apply aspects to the wires
    aspects: {
      // Tap incoming requests
      [createWireId('request-flow')]: [
        {
          id: createAspectId('tap', 1),
          at: 'tapIn',
          params: {
            target: 'console',
            format: { 
              label: '→ Request',
              includeTimestamp: true
            }
          }
        },
        // Rate limit after observing
        {
          id: createAspectId('rate-limit', 1),
          at: 'around',
          params: {
            rps: 100,
            burst: 10,
            onLimit: 'queue',
            queue: { maxSize: 1000 }
          }
        },
        // Credit-based scheduling
        {
          id: createAspectId('credit-gate', 1),
          at: 'around',
          params: {
            initialCredits: 5,
            maxCredits: 20,
            onNoCredits: 'queue'
          }
        }
      ],
      
      // Tap outgoing responses
      [createWireId('response-flow')]: [
        {
          id: createAspectId('tap', 2),
          at: 'tapOut',
          params: {
            target: 'console',
            format: { 
              label: '← Response',
              includeTimestamp: true
            }
          }
        }
      ]
    }
  };
}

// ============================================================================
// Demonstrate Aspect Composition
// ============================================================================

export async function demonstrateComposition() {
  console.log('=== Aspect Composition ===\n');
  
  // Show how rate limits compose via lattice
  const limiter1 = createRateLimitGadget('api-1', { rps: 100, burst: 20 });
  const limiter2 = createRateLimitGadget('api-2', { rps: 50, burst: 30 });
  
  console.log('Rate Limit 1: 100 rps, burst 20');
  console.log('Rate Limit 2: 50 rps, burst 30');
  
  // Composition takes minimum (most restrictive)
  limiter1.compose({ rps: 50, burst: 30 });
  const stats = limiter1.getStats();
  
  console.log('Composed: ' + stats.config.rps + ' rps, burst ' + stats.config.burst);
  console.log('(Takes minimum of each parameter)\n');
}

// ============================================================================
// Simulate API Traffic
// ============================================================================

export async function simulateTraffic() {
  console.log('=== Simulating API Traffic ===\n');
  
  // Create individual gadgets to demonstrate
  const requestTap = createTapGadget('request-tap', {
    target: 'memory',
    format: { label: 'Request' }
  });
  
  const rateLimiter = createRateLimitGadget('rate-limit', {
    rps: 10,
    burst: 5,
    onLimit: 'drop'
  });
  
  const creditGate = createCreditGateGadget('credit-gate', {
    initialCredits: 3,
    maxCredits: 5,
    onNoCredits: 'queue'
  });
  
  // Simulate requests
  const requests = [
    { id: 1, path: '/api/users' },
    { id: 2, path: '/api/posts' },
    { id: 3, path: '/api/comments' },
    { id: 4, path: '/api/likes' },
    { id: 5, path: '/api/shares' }
  ];
  
  console.log('Processing 5 requests...\n');
  
  for (const request of requests) {
    // Tap observes without modification
    requestTap.process(request);
    
    // Rate limiter may drop
    const afterRateLimit = await rateLimiter.process(request);
    if (afterRateLimit) {
      console.log(`✓ Request ${request.id} passed rate limit`);
      
      // Credit gate may queue
      const afterCredits = await creditGate.process(afterRateLimit);
      if (afterCredits) {
        console.log(`✓ Request ${request.id} passed credit gate`);
      } else {
        console.log(`⏸ Request ${request.id} queued by credit gate`);
      }
    } else {
      console.log(`✗ Request ${request.id} dropped by rate limiter`);
    }
  }
  
  console.log('\nTap observations:', requestTap.getObservations().length);
  console.log('Rate limiter stats:', rateLimiter.getStats());
  console.log('Credit gate stats:', creditGate.getStats());
}

// ============================================================================
// Run the Example
// ============================================================================

export async function runAPIPipelineExample() {
  console.log('=== Rate-Limited API Pipeline Example ===\n');
  
  // Create the board
  const board = createAPIPipelineBoard();
  console.log('Created API pipeline with:');
  console.log(`- ${Object.keys(board.slots).length} slots`);
  console.log(`- ${Object.keys(board.wires).length} wires`);
  console.log(`- ${Object.values(board.aspects).flat().length} aspects`);
  console.log();
  
  // Create and initialize binder
  const binder = createBinder(board.id, {
    aspectRegistry: createDefaultAspectRegistry(),
    principal: 'api-system'
  });
  
  await binder.apply({
    id: 'init-pipeline',
    op: 'setBoardIR',
    board
  });
  
  // Lower to see the realized graph with shims
  const graph = binder.lower();
  console.log('Lowered graph contains:');
  console.log(`- ${Object.keys(graph.gadgets).length} gadgets (including shims)`);
  console.log(`- ${Object.keys(graph.wires).length} wires`);
  console.log();
  
  // Demonstrate composition
  await demonstrateComposition();
  
  // Simulate traffic
  await simulateTraffic();
  
  return { board, binder, graph };
}

// ============================================================================
// Main Entry Point
// ============================================================================

if (require.main === module) {
  runAPIPipelineExample()
    .then(() => {
      console.log('\n✅ Example completed successfully');
    })
    .catch(error => {
      console.error('\n❌ Example failed:', error);
      process.exit(1);
    });
}