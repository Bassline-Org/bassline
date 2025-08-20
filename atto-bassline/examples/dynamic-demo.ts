/**
 * Demo: Dynamic Gadgets and Spawners
 * 
 * Shows how networks can modify their own structure at runtime.
 */

import {
  createDynamicGadget,
  createSpawner,
  createEvolver,
  createIterator,
  createTransistor,
  signal,
  propagate,
  wire,
  type DynamicGadgetSpec,
  type TemplateSignal,
  type InstanceSignal,
  formatStrength
} from '../src'

console.log('='.repeat(60))
console.log('DYNAMIC GADGETS DEMO')
console.log('='.repeat(60))

// ============================================================================
// Example 1: Basic Spawning
// ============================================================================

console.log('\n1. Basic Spawning')
console.log('-'.repeat(40))

const spawner = createSpawner('spawner1')

// Define a template for a simple processor
const processorTemplate: TemplateSignal = {
  tag: 'template',
  value: {
    spec: {
      structure: {
        contacts: {
          'input': { direction: 'input' },
          'output': { direction: 'output' },
          '__behavior': { direction: 'input' }
        },
        wires: [
          { from: 'input', to: 'output' }  // Default: pass through
        ]
      },
      bindings: {
        behavior: '__behavior'
      }
    }
  }
}

// Spawn an instance
propagate(spawner.contacts.get('template')!, signal(processorTemplate, 1.0))
propagate(spawner.contacts.get('initialStrength')!, signal(100, 1.0))  // Start weak
propagate(spawner.contacts.get('initialGain')!, signal(50, 1.0))  // Minimal gain
propagate(spawner.contacts.get('trigger')!, signal(true, 1.0))

const outputs = spawner.compute!(new Map([
  ['template', signal(processorTemplate, 1.0)],
  ['initialStrength', signal(100, 1.0)],
  ['initialGain', signal(50, 1.0)],
  ['trigger', signal(true, 1.0)]
]))

const instance = outputs.get('instance')?.value as InstanceSignal

console.log('Spawned instance:', {
  id: instance?.value.id,
  generation: instance?.value.generation,
  born: new Date(instance?.value.born).toISOString()
})
console.log('Spawner now has', spawner.gadgets.size, 'children')

// ============================================================================
// Example 2: Evolution - Gradual Replacement
// ============================================================================

console.log('\n2. Evolution Pattern')
console.log('-'.repeat(40))

// Create v1 and v2 of a gadget
const v1 = createTransistor('processor_v1')
v1.gainPool = 1000  // Old version has lots of gain

const v2 = createTransistor('processor_v2')
v2.gainPool = 100  // New version starts weak

console.log('Initial state:')
console.log('  v1 gain:', v1.gainPool)
console.log('  v2 gain:', v2.gainPool)

// Create evolver to manage transition
const evolver = createEvolver('evolver1')

const v1Instance: InstanceSignal = {
  tag: 'instance',
  value: { id: 'v1', gadget: new WeakRef(v1), born: Date.now(), generation: 1 }
}

const v2Instance: InstanceSignal = {
  tag: 'instance',
  value: { id: 'v2', gadget: new WeakRef(v2), born: Date.now(), generation: 2 }
}

// Evolve over 3 cycles
for (let cycle = 1; cycle <= 3; cycle++) {
  const evolverOutputs = evolver.compute!(new Map([
    ['old', signal(v1Instance, 1.0)],
    ['new', signal(v2Instance, 1.0)],
    ['rate', signal(300, 1.0)],  // Transfer 300 per cycle
    ['threshold', signal(100, 1.0)]  // Keep at least 100
  ]))
  
  const status = evolverOutputs.get('status')?.value as any
  console.log(`\nCycle ${cycle}:`)
  console.log('  Transferred:', status.transferred)
  console.log('  v1 gain:', status.oldGain)
  console.log('  v2 gain:', status.newGain)
  console.log('  Complete:', evolverOutputs.get('complete')?.value)
}

// ============================================================================
// Example 3: Iterator - Mass Production
// ============================================================================

console.log('\n3. Iterator Pattern')
console.log('-'.repeat(40))

const iterator = createIterator('factory')

// Template for worker gadgets
const workerTemplate: TemplateSignal = {
  tag: 'template',
  value: {
    spec: {
      structure: {
        contacts: {
          'input': { direction: 'input' },
          'output': { direction: 'output' },
          'data': { direction: 'input' }
        }
      }
    }
  }
}

// Spawn 5 workers with different data
const workerData = ['alpha', 'beta', 'gamma', 'delta', 'epsilon']

const iteratorOutputs = iterator.compute!(new Map([
  ['template', signal(workerTemplate, 1.0)],
  ['count', signal(5, 1.0)],
  ['data', signal(workerData, 1.0)],
  ['trigger', signal(true, 1.0)]
]))

const instances = iteratorOutputs.get('instances')?.value as InstanceSignal[]

console.log(`Spawned ${instances.length} workers`)
for (let i = 0; i < instances.length; i++) {
  const worker = iterator.gadgets.get(`item_${i}`)
  console.log(`  Worker ${i}: gain=${worker?.gainPool}, data=${workerData[i]}`)
}

// ============================================================================
// Example 4: Dynamic Pipeline
// ============================================================================

console.log('\n4. Dynamic Pipeline')
console.log('-'.repeat(40))

// Create a pipeline that can have stages added dynamically
const pipelineSpec: DynamicGadgetSpec = {
  structure: {
    contacts: {
      'input': { direction: 'input' },
      'output': { direction: 'output' }
    },
    children: {
      'spawner': {
        structure: {
          contacts: {
            'template': { direction: 'input' },
            'trigger': { direction: 'input' }
          }
        }
      }
    },
    wires: []
  }
}

const pipeline = createDynamicGadget('pipeline', pipelineSpec)

console.log('Pipeline structure:')
console.log('  Contacts:', Array.from(pipeline.contacts.keys()))
console.log('  Children:', Array.from(pipeline.gadgets.keys()))

// Define behavior for a stage
const stageBehavior = {
  compute: {
    type: 'expression' as const,
    expr: {
      op: 'add',
      args: { a: 'input', b: 'input' }
    }
  }
}

// The pipeline can spawn its own stages!
const stageTemplate: TemplateSignal = {
  tag: 'template',
  value: {
    spec: {
      structure: {
        contacts: {
          'input': { direction: 'input' },
          'output': { direction: 'output' },
          '__behavior': { direction: 'input' }
        }
      },
      bindings: { behavior: '__behavior' }
    }
  }
}

console.log('\nPipeline ready for dynamic stage addition')
console.log('Stages can be spawned and wired at runtime!')

// ============================================================================
// Example 5: Self-Modifying Network
// ============================================================================

console.log('\n5. Self-Modifying Network')
console.log('-'.repeat(40))

// A network that spawns its own improved versions
const selfModifyingSpec: DynamicGadgetSpec = {
  structure: {
    contacts: {
      'input': { direction: 'input' },
      'output': { direction: 'output' },
      'fitness': { direction: 'input' }
    },
    children: {
      'spawner': {
        structure: {
          contacts: {
            'template': { direction: 'input' },
            'trigger': { direction: 'input' }
          }
        }
      },
      'evolver': {
        structure: {
          contacts: {
            'old': { direction: 'input' },
            'new': { direction: 'input' },
            'rate': { direction: 'input' }
          }
        }
      }
    }
  }
}

const selfModifying = createDynamicGadget('self-modifier', selfModifyingSpec)

console.log('Self-modifying network created')
console.log('  Can spawn improved versions of itself')
console.log('  Can evolve strength to better versions')
console.log('  Fitness signal controls evolution rate')

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '='.repeat(60))
console.log('KEY INSIGHTS')
console.log('='.repeat(60))

console.log(`
1. Structure is built EAGERLY - contacts and wires exist immediately
2. Behavior is bound LATE - computation arrives as data
3. New structures start WEAK - must earn trust through validation
4. Evolution is GRADUAL - strength transfers over time
5. Everything is DATA - templates flow through the network

This enables:
- Hot-swapping behaviors at runtime
- Self-modifying network topologies
- Safe experimentation with new structures
- Gradual migration between versions
- Meta-circular evaluation
`)

console.log('The network is alive! 🧬')