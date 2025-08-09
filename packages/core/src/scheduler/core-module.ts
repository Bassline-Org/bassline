/**
 * Core scheduler module - exports all built-in schedulers as factory functions
 * This is the main module loaded by the SchedulerDriver
 */

import { createImmediateScheduler } from './immediate'
import { createBatchScheduler, createAnimationFrameScheduler, createPriorityScheduler } from './batch'
import type { Scheduler } from '../kernel/drivers/scheduler-driver'
import type { PropagationNetworkScheduler } from '../types'

// Adapter to convert PropagationNetworkScheduler to Scheduler interface
function adaptScheduler(
  id: string,
  name: string,
  factory: () => PropagationNetworkScheduler,
  characteristics: Scheduler['characteristics'],
  description?: string
): () => Scheduler {
  return () => {
    const networkScheduler = factory()
    
    return {
      id,
      name,
      characteristics,
      description,
      
      schedule(task) {
        // Convert PropagationTask to scheduler update
        networkScheduler.scheduleUpdate(task.contactId, task.content, task.priority)
      },
      
      async flush() {
        // Flush if supported
        if ('flush' in networkScheduler && typeof networkScheduler.flush === 'function') {
          await networkScheduler.flush()
        }
      },
      
      clear() {
        // Clear if supported - most schedulers don't need this
        if ('clear' in networkScheduler && typeof networkScheduler.clear === 'function') {
          networkScheduler.clear()
        }
      },
      
      configure(options) {
        // Configure if supported
        if ('configure' in networkScheduler && typeof networkScheduler.configure === 'function') {
          networkScheduler.configure(options)
        }
      }
    }
  }
}

// Export scheduler factories
export function immediate(): Scheduler {
  return adaptScheduler(
    'immediate',
    'Immediate',
    createImmediateScheduler,
    {
      deterministic: true,
      batching: false,
      priority: false,
      async: false,
      fairness: 'strict'
    },
    'Executes propagation tasks immediately in order'
  )()
}

export function batch(): Scheduler {
  return adaptScheduler(
    'batch',
    'Batch',
    () => createBatchScheduler({ batchSize: 10, batchDelay: 16 }),
    {
      deterministic: true,
      batching: true,
      priority: false,
      async: true,
      fairness: 'best-effort'
    },
    'Groups updates into batches for better performance'
  )()
}

export function animationFrame(): Scheduler {
  return adaptScheduler(
    'animation-frame',
    'Animation Frame',
    createAnimationFrameScheduler,
    {
      deterministic: false,
      batching: true,
      priority: false,
      async: true,
      fairness: 'best-effort'
    },
    'Synchronizes updates with browser animation frames'
  )()
}

export function priority(): Scheduler {
  return adaptScheduler(
    'priority',
    'Priority',
    createPriorityScheduler,
    {
      deterministic: false,
      batching: false,
      priority: true,
      async: true,
      fairness: 'none'
    },
    'Executes higher priority tasks first'
  )()
}