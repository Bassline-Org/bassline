import { GadgetId, ContactId, PinId, brand } from '../core/types';
import { ContactStore } from './contact-store';
import { SlotManager } from './slot-manager';
import { PropagationEngine } from './propagation-engine';
import type { Gadget } from '../stdlib/primitives/base';

/**
 * Gadget executor - handles gadget activation and execution
 * when their input contacts change.
 */

export interface GadgetExecution {
  gadgetId: GadgetId;
  inputValues: Map<string, unknown>;
  outputValues: Map<string, unknown>;
  executed: boolean;
  timestamp: number;
  duration: number;
}

export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  lastExecution?: GadgetExecution;
}

export class GadgetExecutor {
  private contactStore: ContactStore;
  private slotManager: SlotManager;
  private propagationEngine: PropagationEngine;
  private gadgetInstances = new Map<GadgetId, Gadget>();
  private executionStats = new Map<GadgetId, ExecutionStats>();
  private executionListeners = new Set<(execution: GadgetExecution) => void>();
  
  constructor(
    contactStore: ContactStore, 
    slotManager: SlotManager,
    propagationEngine: PropagationEngine
  ) {
    this.contactStore = contactStore;
    this.slotManager = slotManager;
    this.propagationEngine = propagationEngine;
    
    // Subscribe to propagation changes to trigger gadget execution
    this.propagationEngine.onChange(async (contactId, oldValue, newValue) => {
      await this.handleContactChange(contactId, oldValue, newValue);
    });
  }
  
  /**
   * Register a gadget instance
   */
  registerGadget(gadgetId: GadgetId, gadget: Gadget): void {
    this.gadgetInstances.set(gadgetId, gadget);
    this.executionStats.set(gadgetId, {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0
    });
  }
  
  /**
   * Unregister a gadget instance
   */
  unregisterGadget(gadgetId: GadgetId): void {
    this.gadgetInstances.delete(gadgetId);
    this.executionStats.delete(gadgetId);
  }
  
  /**
   * Handle contact change - check if it triggers any gadget
   */
  private async handleContactChange(
    contactId: ContactId,
    oldValue: unknown,
    newValue: unknown
  ): Promise<void> {
    // Find gadgets that have this contact as an input
    for (const [gadgetId, gadget] of this.gadgetInstances) {
      const mountInfo = this.slotManager.getMountInfo(gadgetId);
      if (!mountInfo) continue;
      
      // Check if this contact is an input to the gadget
      let isInput = false;
      let inputName: string | undefined;
      
      for (const [pinId, mappedContactId] of mountInfo.pinMappings) {
        if (mappedContactId === contactId) {
          // Extract pin name from pinId (format: gadget://id:pinName)
          const pinStr = pinId.toString();
          const lastColonIndex = pinStr.lastIndexOf(':');
          if (lastColonIndex !== -1) {
            const pinName = pinStr.substring(lastColonIndex + 1);
            if (gadget.inputs.includes(pinName)) {
              isInput = true;
              inputName = pinName;
              break;
            }
          }
        }
      }
      
      if (isInput) {
        // This gadget has the changed contact as an input
        await this.executeGadget(gadgetId);
      }
    }
  }
  
  /**
   * Execute a gadget
   */
  async executeGadget(gadgetId: GadgetId): Promise<GadgetExecution> {
    const startTime = performance.now();
    const gadget = this.gadgetInstances.get(gadgetId);
    const mountInfo = this.slotManager.getMountInfo(gadgetId);
    
    if (!gadget || !mountInfo) {
      throw new Error(`Gadget ${gadgetId} not found or not mounted`);
    }
    
    // Collect input values
    const inputValues = new Map<string, unknown>();
    for (const inputName of gadget.inputs) {
      const pinId = brand.pinId(`${gadgetId}:${inputName}`);
      const contactId = mountInfo.pinMappings.get(pinId);
      if (contactId) {
        const value = this.contactStore.getValue(contactId);
        if (value !== undefined) {
          inputValues.set(inputName, value);
        }
      }
    }
    
    // Check activation condition
    const shouldActivate = gadget.activation(inputValues);
    
    const execution: GadgetExecution = {
      gadgetId,
      inputValues,
      outputValues: new Map(),
      executed: false,
      timestamp: Date.now(),
      duration: 0
    };
    
    if (shouldActivate) {
      try {
        // Execute gadget body
        const outputValues = await gadget.process(inputValues);
        execution.outputValues = outputValues;
        execution.executed = true;
        
        // Update output contacts and propagate
        for (const [outputName, outputValue] of outputValues) {
          const pinId = brand.pinId(`${gadgetId}:${outputName}`);
          const contactId = mountInfo.pinMappings.get(pinId);
          if (contactId) {
            // Use propagation engine instead of direct update
            // This ensures downstream contacts get updated
            await this.propagationEngine.propagate(contactId, outputValue);
          }
        }
        
        // Update stats
        const stats = this.executionStats.get(gadgetId)!;
        stats.totalExecutions++;
        stats.successfulExecutions++;
        
      } catch (error) {
        console.error(`Failed to execute gadget ${gadgetId}:`, error);
        
        // Update stats
        const stats = this.executionStats.get(gadgetId)!;
        stats.totalExecutions++;
        stats.failedExecutions++;
      }
    }
    
    execution.duration = performance.now() - startTime;
    
    // Update average duration
    const stats = this.executionStats.get(gadgetId)!;
    if (stats.totalExecutions > 0) {
      const prevAvg = stats.averageDuration;
      const prevTotal = prevAvg * (stats.totalExecutions - 1);
      stats.averageDuration = (prevTotal + execution.duration) / stats.totalExecutions;
    }
    stats.lastExecution = execution;
    
    // Notify listeners
    for (const listener of this.executionListeners) {
      listener(execution);
    }
    
    return execution;
  }
  
  /**
   * Force execution of a gadget (bypass activation check)
   */
  async forceExecute(gadgetId: GadgetId): Promise<GadgetExecution> {
    const gadget = this.gadgetInstances.get(gadgetId);
    if (!gadget) {
      throw new Error(`Gadget ${gadgetId} not found`);
    }
    
    // Temporarily override activation
    const originalActivation = gadget.activation;
    gadget.activation = () => true;
    
    try {
      return await this.executeGadget(gadgetId);
    } finally {
      gadget.activation = originalActivation;
    }
  }
  
  /**
   * Get execution statistics for a gadget
   */
  getStats(gadgetId: GadgetId): ExecutionStats | undefined {
    return this.executionStats.get(gadgetId);
  }
  
  /**
   * Get all execution statistics
   */
  getAllStats(): Map<GadgetId, ExecutionStats> {
    return new Map(this.executionStats);
  }
  
  /**
   * Subscribe to execution events
   */
  onExecution(listener: (execution: GadgetExecution) => void): () => void {
    this.executionListeners.add(listener);
    return () => this.executionListeners.delete(listener);
  }
  
  /**
   * Clear all data
   */
  clear(): void {
    this.gadgetInstances.clear();
    this.executionStats.clear();
    this.executionListeners.clear();
  }
}