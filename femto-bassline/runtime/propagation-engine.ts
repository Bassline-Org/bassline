import { ContactId, WireId } from '../core/types';
import { ContactStore } from './contact-store';
import type { Lattice } from '../core/lattice';

export type PropagationListener = (contactId: ContactId, oldValue: unknown, newValue: unknown) => void | Promise<void>;

/**
 * Propagation engine - handles value propagation through the network
 * with cycle detection and convergence guarantees.
 */

export interface PropagationTask {
  sourceContact: ContactId;
  targetContact: ContactId;
  value: unknown;
  wireId: WireId;
  depth: number; // For cycle detection
}

export interface PropagationStats {
  tasksProcessed: number;
  valuesChanged: number;
  cyclesDetected: number;
  propagationDepth: number;
  duration: number;
}

export class PropagationEngine {
  private contactStore: ContactStore;
  private maxDepth = 100; // Maximum propagation depth before assuming divergence
  private cycleThreshold = 10; // Number of times a contact can be visited in one propagation
  private stats: PropagationStats;
  private changeListeners = new Set<PropagationListener>();
  
  constructor(contactStore: ContactStore) {
    this.contactStore = contactStore;
    this.stats = {
      tasksProcessed: 0,
      valuesChanged: 0,
      cyclesDetected: 0,
      propagationDepth: 0,
      duration: 0
    };
  }
  
  /**
   * Propagate a value update through the network
   */
  async propagate(
    sourceContact: ContactId,
    newValue: unknown
  ): Promise<PropagationStats> {
    const startTime = performance.now();
    
    // Reset stats for this propagation
    this.stats = {
      tasksProcessed: 0,
      valuesChanged: 0,
      cyclesDetected: 0,
      propagationDepth: 0,
      duration: 0
    };
    
    // Initialize propagation queue
    const queue: PropagationTask[] = [];
    const visitCounts = new Map<ContactId, number>();
    
    // Get old value for change notification
    const oldSourceValue = this.contactStore.getValue(sourceContact);
    
    // Update source contact and check if it changed
    const changed = this.contactStore.updateValue(sourceContact, newValue);
    if (!changed) {
      // No change, nothing to propagate
      this.stats.duration = performance.now() - startTime;
      return this.stats;
    }
    
    this.stats.valuesChanged++;
    
    // Notify listeners of source contact change
    for (const listener of this.changeListeners) {
      await listener(sourceContact, oldSourceValue, newValue);
    }
    
    // Get downstream contacts and queue them
    const downstream = this.contactStore.getDownstreamContacts(sourceContact);
    for (const targetContact of downstream) {
      const connections = this.contactStore.getConnections(sourceContact);
      for (const conn of connections) {
        if (conn.toContact === targetContact && conn.isActive) {
          queue.push({
            sourceContact,
            targetContact,
            value: this.contactStore.getValue(sourceContact),
            wireId: conn.wireId,
            depth: 1
          });
        }
      }
    }
    
    // Process propagation queue
    while (queue.length > 0) {
      const task = queue.shift()!;
      this.stats.tasksProcessed++;
      
      // Update max depth
      if (task.depth > this.stats.propagationDepth) {
        this.stats.propagationDepth = task.depth;
      }
      
      // Check for excessive depth (potential divergence)
      if (task.depth > this.maxDepth) {
        console.warn(`Propagation depth exceeded ${this.maxDepth} - possible divergence`);
        break;
      }
      
      // Track visit counts for cycle detection
      const visitCount = (visitCounts.get(task.targetContact) || 0) + 1;
      visitCounts.set(task.targetContact, visitCount);
      
      if (visitCount > this.cycleThreshold) {
        this.stats.cyclesDetected++;
        console.warn(`Contact ${task.targetContact} visited ${visitCount} times - cycle detected`);
        continue; // Skip this propagation
      }
      
      // Get old value for change notification
      const oldValue = this.contactStore.getValue(task.targetContact);
      
      // Update target contact value
      const targetChanged = this.contactStore.updateValue(task.targetContact, task.value);
      
      if (targetChanged) {
        this.stats.valuesChanged++;
        
        // Notify listeners of the change
        const newValue = this.contactStore.getValue(task.targetContact);
        for (const listener of this.changeListeners) {
          await listener(task.targetContact, oldValue, newValue);
        }
        
        // Queue downstream propagations
        const nextValue = this.contactStore.getValue(task.targetContact);
        const nextDownstream = this.contactStore.getDownstreamContacts(task.targetContact);
        
        for (const nextTarget of nextDownstream) {
          // Don't propagate back to source (avoid immediate cycles)
          if (nextTarget === task.sourceContact) {
            continue;
          }
          
          const connections = this.contactStore.getConnections(task.targetContact);
          for (const conn of connections) {
            if (conn.toContact === nextTarget && conn.isActive) {
              queue.push({
                sourceContact: task.targetContact,
                targetContact: nextTarget,
                value: nextValue,
                wireId: conn.wireId,
                depth: task.depth + 1
              });
            }
          }
        }
      }
    }
    
    this.stats.duration = performance.now() - startTime;
    return this.stats;
  }
  
  /**
   * Batch propagate multiple updates
   */
  async batchPropagate(
    updates: Array<{ contact: ContactId; value: unknown }>
  ): Promise<PropagationStats> {
    const totalStats: PropagationStats = {
      tasksProcessed: 0,
      valuesChanged: 0,
      cyclesDetected: 0,
      propagationDepth: 0,
      duration: 0
    };
    
    for (const update of updates) {
      const stats = await this.propagate(update.contact, update.value);
      totalStats.tasksProcessed += stats.tasksProcessed;
      totalStats.valuesChanged += stats.valuesChanged;
      totalStats.cyclesDetected += stats.cyclesDetected;
      totalStats.propagationDepth = Math.max(totalStats.propagationDepth, stats.propagationDepth);
      totalStats.duration += stats.duration;
    }
    
    return totalStats;
  }
  
  /**
   * Configure propagation limits
   */
  setLimits(maxDepth: number, cycleThreshold: number): void {
    this.maxDepth = maxDepth;
    this.cycleThreshold = cycleThreshold;
  }
  
  /**
   * Get current statistics
   */
  getStats(): PropagationStats {
    return { ...this.stats };
  }
  
  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      tasksProcessed: 0,
      valuesChanged: 0,
      cyclesDetected: 0,
      propagationDepth: 0,
      duration: 0
    };
  }
  
  /**
   * Subscribe to propagation changes
   */
  onChange(listener: PropagationListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }
}