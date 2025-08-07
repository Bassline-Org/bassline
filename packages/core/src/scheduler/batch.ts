import type { PropagationNetworkScheduler, PropagationTask } from '../types'
import { createImmediateScheduler } from './immediate'

export interface BatchSchedulerOptions {
  batchSize?: number
  batchDelay?: number // milliseconds
}

export function createBatchScheduler(
  options: BatchSchedulerOptions = {}
): PropagationNetworkScheduler {
  const { batchSize = 10, batchDelay = 16 } = options // 16ms = ~60fps
  
  // Base scheduler for most operations
  const baseScheduler = createImmediateScheduler()
  
  // Batch processing state
  let pendingUpdates: Array<{ contactId: string; content: unknown }> = []
  let batchTimeout: NodeJS.Timeout | null = null
  let processingPromise: Promise<void> | null = null
  
  // Process a batch of updates
  async function processBatch() {
    const batch = pendingUpdates.splice(0, batchSize)
    
    // Process all updates in the batch
    for (const update of batch) {
      await baseScheduler.scheduleUpdate(update.contactId, update.content)
    }
    
    // If there are more pending, schedule next batch
    if (pendingUpdates.length > 0) {
      batchTimeout = setTimeout(() => {
        processingPromise = processBatch()
      }, batchDelay)
    } else {
      batchTimeout = null
      processingPromise = null
    }
  }
  
  // Return scheduler with batched update
  return {
    ...baseScheduler,
    
    async scheduleUpdate(contactId, content) {
      // Add to pending batch
      pendingUpdates.push({ contactId, content })
      
      // Start batch processing if not already running
      if (!batchTimeout) {
        batchTimeout = setTimeout(() => {
          processingPromise = processBatch()
        }, batchDelay)
      }
      
      // Return immediately (async processing)
      return Promise.resolve()
    },
    
    // For testing - process all pending updates immediately
    async flush() {
      if (batchTimeout) {
        clearTimeout(batchTimeout)
        batchTimeout = null
      }
      
      while (pendingUpdates.length > 0) {
        await processBatch()
      }
    }
  } as PropagationNetworkScheduler & { flush: () => Promise<void> }
}

// Specialized batch schedulers

// Process updates in animation frames for smooth UI updates
export function createAnimationFrameScheduler(): PropagationNetworkScheduler {
  const baseScheduler = createImmediateScheduler()
  let pendingUpdates: Array<{ contactId: string; content: unknown }> = []
  let rafId: number | NodeJS.Timeout | null = null
  
  async function processFrame() {
    const updates = [...pendingUpdates]
    pendingUpdates = []
    rafId = null
    
    for (const update of updates) {
      await baseScheduler.scheduleUpdate(update.contactId, update.content)
    }
  }
  
  return {
    ...baseScheduler,
    
    async scheduleUpdate(contactId, content) {
      pendingUpdates.push({ contactId, content })
      
      if (!rafId && typeof requestAnimationFrame !== 'undefined') {
        rafId = requestAnimationFrame(() => {
          processFrame()
        }) as unknown as number
      } else if (!rafId) {
        // Fallback for non-browser environments
        rafId = setTimeout(processFrame, 16)
      }
    }
  }
}

// Process updates with priority (higher priority first)
export function createPriorityScheduler(): PropagationNetworkScheduler {
  const baseScheduler = createImmediateScheduler()
  let pendingTasks: PropagationTask[] = []
  let processing = false
  
  async function processTasks() {
    if (processing) return
    processing = true
    
    // Sort by priority (higher first) then by timestamp (older first)
    pendingTasks.sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0)
      if (priorityDiff !== 0) return priorityDiff
      return a.timestamp - b.timestamp
    })
    
    while (pendingTasks.length > 0) {
      const task = pendingTasks.shift()!
      await baseScheduler.scheduleUpdate(task.contactId, task.content)
    }
    
    processing = false
  }
  
  return {
    ...baseScheduler,
    
    async scheduleUpdate(contactId, content, priority = 0) {
      pendingTasks.push({
        id: crypto.randomUUID(),
        groupId: '', // Will be determined by baseScheduler
        contactId,
        content,
        priority,
        timestamp: Date.now()
      })
      
      // Process asynchronously
      setTimeout(processTasks, 0)
    }
  } as PropagationNetworkScheduler
}