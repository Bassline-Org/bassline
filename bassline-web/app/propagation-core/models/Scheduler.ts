/**
 * Scheduler interface for controlling propagation execution
 */
export interface Scheduler {
  schedule(fn: () => void): void;
  
  // Query state
  isQuiescent(): boolean;      // No pending work
  hasPendingWork(): boolean;    // Has work queued
  pendingCount(): number;       // How many tasks queued
  
  // Control execution
  flush(): void;                // Process all pending work
  clear(): void;                // Discard pending work
}

/**
 * Executes propagation immediately (synchronous)
 */
export class ImmediateScheduler implements Scheduler {
  schedule(fn: () => void): void {
    fn();
  }
  
  isQuiescent(): boolean {
    return true; // Always quiescent since we execute immediately
  }
  
  hasPendingWork(): boolean {
    return false;
  }
  
  pendingCount(): number {
    return 0;
  }
  
  flush(): void {
    // Nothing to flush
  }
  
  clear(): void {
    // Nothing to clear
  }
}

/**
 * Queues propagation for batch execution
 */
export class QueuedScheduler implements Scheduler {
  private queue: Array<() => void> = [];
  private isProcessing = false;
  
  schedule(fn: () => void): void {
    this.queue.push(fn);
  }
  
  isQuiescent(): boolean {
    return this.queue.length === 0 && !this.isProcessing;
  }
  
  hasPendingWork(): boolean {
    return this.queue.length > 0;
  }
  
  pendingCount(): number {
    return this.queue.length;
  }
  
  flush(): void {
    this.isProcessing = true;
    try {
      while (this.queue.length > 0) {
        const fn = this.queue.shift()!;
        fn();
      }
    } finally {
      this.isProcessing = false;
    }
  }
  
  clear(): void {
    this.queue = [];
  }
}