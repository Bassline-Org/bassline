/**
 * Example Scheduler Circuits
 * 
 * Demonstrates how schedulers are just circuits that transform
 * PropagationEvent streams into Action streams.
 * 
 * The key insight: Schedulers aren't special machinery, they're just
 * subnetworks that process event streams!
 */

import {
  Bassline,
  ReifiedGroup,
  ReifiedContact,
  ReifiedWire,
  ContactId,
  GroupId,
  WireId
} from './types'

/**
 * Creates an immediate scheduler circuit.
 * This is the simplest scheduler - it just passes events through
 * and converts them to actions immediately.
 * 
 * Circuit structure:
 * events → [events-to-actions] → actions
 */
export function createImmediateScheduler(): Partial<Bassline> {
  const contacts = new Map<ContactId, ReifiedContact>([
    ['immediate-events-in', {
      properties: { 
        blendMode: 'last',  // Stream input
        name: 'events'
      }
    }],
    ['immediate-actions-out', {
      properties: { 
        blendMode: 'last',  // Stream output
        name: 'actions'
      }
    }]
  ])
  
  const groups = new Map<GroupId, ReifiedGroup>([
    ['immediate-converter', {
      contactIds: new Set(['immediate-events-in', 'immediate-actions-out']),
      boundaryContactIds: new Set(['immediate-events-in', 'immediate-actions-out']),
      primitiveType: 'events-to-actions',
      properties: {}
    }]
  ])
  
  const wires = new Map<WireId, ReifiedWire>()
  
  return { contacts, groups, wires }
}

/**
 * Creates a batch scheduler circuit.
 * Collects N events before processing them as a batch.
 * 
 * Circuit structure:
 * events → [batch-collector] → [events-to-actions] → actions
 *             ↑         ↓
 *          counter  batch-ready
 */
export function createBatchScheduler(batchSize: number = 10): Partial<Bassline> {
  const contacts = new Map<ContactId, ReifiedContact>([
    // Input/Output
    ['batch-events-in', {
      properties: { 
        blendMode: 'last',
        name: 'events'
      }
    }],
    ['batch-actions-out', {
      properties: { 
        blendMode: 'last',
        name: 'actions'
      }
    }],
    
    // Internal state
    ['batch-buffer', {
      content: [],
      properties: { 
        blendMode: 'merge'  // Accumulates events
      }
    }],
    ['batch-counter', {
      content: 0,
      properties: { 
        blendMode: 'last'
      }
    }],
    ['batch-ready', {
      properties: { 
        blendMode: 'last'
      }
    }]
  ])
  
  const groups = new Map<GroupId, ReifiedGroup>([
    // Custom batch collector gadget would go here
    // For now, showing the structure
    ['batch-collector', {
      contactIds: new Set(['batch-events-in', 'batch-buffer', 'batch-counter', 'batch-ready']),
      boundaryContactIds: new Set(['batch-events-in', 'batch-ready']),
      primitiveType: 'batch-collect',  // Custom primitive
      properties: {
        batchSize
      }
    }],
    
    ['batch-converter', {
      contactIds: new Set(['batch-ready', 'batch-actions-out']),
      boundaryContactIds: new Set(['batch-ready', 'batch-actions-out']),
      primitiveType: 'events-to-actions',
      properties: {}
    }]
  ])
  
  const wires = new Map<WireId, ReifiedWire>([
    ['batch-ready-to-converter', {
      fromId: 'batch-ready',
      toId: 'batch-converter-input',
      properties: {}
    }]
  ])
  
  return { contacts, groups, wires }
}

/**
 * Creates a priority scheduler circuit.
 * Processes events based on priority properties.
 * 
 * Circuit structure:
 * events → [priority-queue] → [take-highest] → [events-to-actions] → actions
 *              ↑                    ↓
 *         priority-map         tick-signal
 */
export function createPriorityScheduler(): Partial<Bassline> {
  const contacts = new Map<ContactId, ReifiedContact>([
    ['priority-events-in', {
      properties: { 
        blendMode: 'last',
        name: 'events'
      }
    }],
    ['priority-actions-out', {
      properties: { 
        blendMode: 'last',
        name: 'actions'
      }
    }],
    
    // Priority queue (accumulated events with priorities)
    ['priority-queue', {
      content: [],
      properties: { 
        blendMode: 'merge'  // Accumulates
      }
    }],
    
    // Tick signal to process next item
    ['priority-tick', {
      properties: { 
        blendMode: 'last'  // Stream of tick events
      }
    }],
    
    // Current highest priority event
    ['priority-current', {
      properties: { 
        blendMode: 'last'
      }
    }]
  ])
  
  const groups = new Map<GroupId, ReifiedGroup>([
    // Priority queue manager
    ['priority-manager', {
      contactIds: new Set(['priority-events-in', 'priority-queue', 'priority-tick', 'priority-current']),
      boundaryContactIds: new Set(['priority-events-in', 'priority-tick', 'priority-current']),
      primitiveType: 'priority-select',  // Custom primitive
      properties: {}
    }],
    
    // Convert selected event to action
    ['priority-converter', {
      contactIds: new Set(['priority-current', 'priority-actions-out']),
      boundaryContactIds: new Set(['priority-current', 'priority-actions-out']),
      primitiveType: 'events-to-actions',
      properties: {}
    }]
  ])
  
  const wires = new Map<WireId, ReifiedWire>([
    ['current-to-converter', {
      fromId: 'priority-current',
      toId: 'priority-converter-input',
      properties: {}
    }]
  ])
  
  return { contacts, groups, wires }
}

/**
 * Creates a filtering scheduler circuit.
 * Only processes events that match certain criteria.
 * 
 * Circuit structure:
 * events → [filter] → [events-to-actions] → actions
 *             ↑
 *         filter-criteria
 */
export function createFilteringScheduler(filterType: string): Partial<Bassline> {
  const contacts = new Map<ContactId, ReifiedContact>([
    ['filter-events-in', {
      properties: { 
        blendMode: 'last',
        name: 'events'
      }
    }],
    ['filter-actions-out', {
      properties: { 
        blendMode: 'last',
        name: 'actions'
      }
    }],
    
    // Filter criteria
    ['filter-criteria', {
      content: filterType,  // e.g., 'valueChanged' to only process value changes
      properties: { 
        blendMode: 'last'
      }
    }],
    
    // Filtered events
    ['filter-passed', {
      properties: { 
        blendMode: 'last'  // Stream
      }
    }]
  ])
  
  const groups = new Map<GroupId, ReifiedGroup>([
    // Event filter
    ['filter-gadget', {
      contactIds: new Set(['filter-events-in', 'filter-criteria', 'filter-passed']),
      boundaryContactIds: new Set(['filter-events-in', 'filter-criteria', 'filter-passed']),
      primitiveType: 'filter-events',
      properties: {}
    }],
    
    // Convert filtered events to actions
    ['filter-converter', {
      contactIds: new Set(['filter-passed', 'filter-actions-out']),
      boundaryContactIds: new Set(['filter-passed', 'filter-actions-out']),
      primitiveType: 'events-to-actions',
      properties: {}
    }]
  ])
  
  const wires = new Map<WireId, ReifiedWire>([
    ['passed-to-converter', {
      fromId: 'filter-passed',
      toId: 'filter-converter-input',
      properties: {}
    }]
  ])
  
  return { contacts, groups, wires }
}

/**
 * Example of composing schedulers.
 * This creates a scheduler that first filters, then batches.
 * 
 * Circuit structure:
 * events → [filter] → [batch] → [events-to-actions] → actions
 */
export function createComposedScheduler(
  filterType: string,
  batchSize: number
): Partial<Bassline> {
  // This would compose the filter and batch schedulers
  // by wiring the filter output to the batch input
  
  const contacts = new Map<ContactId, ReifiedContact>([
    ['composed-events-in', {
      properties: { 
        blendMode: 'last',
        name: 'events'
      }
    }],
    ['composed-actions-out', {
      properties: { 
        blendMode: 'last',
        name: 'actions'
      }
    }],
    
    // Intermediate stream between filter and batch
    ['composed-filtered', {
      properties: { 
        blendMode: 'last'
      }
    }]
  ])
  
  // Would include both filter and batch subgroups
  const groups = new Map<GroupId, ReifiedGroup>()
  
  // Wire them together
  const wires = new Map<WireId, ReifiedWire>()
  
  return { contacts, groups, wires }
}

/**
 * Demonstrates how to wire a scheduler circuit into a network.
 * 
 * The pattern is:
 * 1. BasslineGadget.events → Scheduler.events-in
 * 2. Scheduler.actions-out → BasslineGadget.actions
 * 
 * This creates the feedback loop for meta-propagation.
 */
export function wireSchedulerToNetwork(
  basslineGadgetEventsId: ContactId,
  basslineGadgetActionsId: ContactId,
  schedulerEventsInId: ContactId,
  schedulerActionsOutId: ContactId
): ReifiedWire[] {
  return [
    {
      fromId: basslineGadgetEventsId,
      toId: schedulerEventsInId,
      properties: {
        bidirectional: false  // Events flow one way
      }
    },
    {
      fromId: schedulerActionsOutId,
      toId: basslineGadgetActionsId,
      properties: {
        bidirectional: false  // Actions flow one way
      }
    }
  ]
}

/**
 * The key insight demonstrated by these examples:
 * 
 * Schedulers are NOT special runtime machinery.
 * They are just circuits (subnetworks) that:
 * 
 * 1. Take PropagationEvent streams as input
 * 2. Apply some transformation logic
 * 3. Output Action streams
 * 
 * Different scheduling strategies are just different circuit designs.
 * You can compose them, modify them, and even have the network
 * modify its own scheduler at runtime!
 * 
 * This is the power of the unified model - everything is propagation.
 */