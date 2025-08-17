import { z } from 'zod';
import { 
  BoardId,
  BoardIR,
  RealizedGraph,
  ContactId,
  GadgetId,
  WireId,
  SlotId,
  brand
} from '../core/types';
import { ContactStore } from './contact-store';
import { SlotManager } from './slot-manager';
import { PropagationEngine } from './propagation-engine';
import { GadgetExecutor } from './gadget-executor';
import { AspectRegistry } from './aspects';
import { NumberLattice } from '../core/lattice';
import type { Gadget } from '../stdlib/primitives/base';

/**
 * Graph executor - main runtime for executing realized propagation graphs.
 * Coordinates contact store, slot manager, propagation engine, and gadget executor.
 */

export interface ExecutorConfig {
  maxPropagationDepth?: number;
  cycleThreshold?: number;
  enableDebugLogging?: boolean;
}

export interface ExecutionContext {
  boardId: BoardId;
  ir: BoardIR;
  realized: RealizedGraph;
  contactStore: ContactStore;
  slotManager: SlotManager;
  propagationEngine: PropagationEngine;
  gadgetExecutor: GadgetExecutor;
}

export class GraphExecutor {
  private contexts = new Map<BoardId, ExecutionContext>();
  private aspectRegistry: AspectRegistry;
  private config: ExecutorConfig;
  private gadgetLibrary = new Map<string, Gadget>();
  
  constructor(
    aspectRegistry: AspectRegistry,
    config: ExecutorConfig = {}
  ) {
    this.aspectRegistry = aspectRegistry;
    this.config = {
      maxPropagationDepth: config.maxPropagationDepth ?? 100,
      cycleThreshold: config.cycleThreshold ?? 10,
      enableDebugLogging: config.enableDebugLogging ?? false
    };
  }
  
  /**
   * Register a gadget in the library
   */
  registerGadget(name: string, gadget: Gadget): void {
    this.gadgetLibrary.set(name, gadget);
  }
  
  /**
   * Initialize execution context for a board
   */
  async initializeBoard(boardId: BoardId, ir: BoardIR): Promise<ExecutionContext> {
    if (this.contexts.has(boardId)) {
      throw new Error(`Board ${boardId} already initialized`);
    }
    
    // Create runtime components
    const contactStore = new ContactStore();
    const slotManager = new SlotManager();
    const propagationEngine = new PropagationEngine(contactStore);
    const gadgetExecutor = new GadgetExecutor(contactStore, slotManager, propagationEngine);
    
    // Configure propagation limits
    propagationEngine.setLimits(
      this.config.maxPropagationDepth!,
      this.config.cycleThreshold!
    );
    
    // Create a simple realized graph (without full binder lowering)
    const realized: RealizedGraph = {
      nodes: {},
      edges: {},
      receipts: []
    };
    
    // Initialize slots from IR
    for (const slot of Object.values(ir.slots)) {
      slotManager.registerSlot(slot);
    }
    
    // Initialize contacts from realized graph
    for (const node of Object.values(realized.nodes)) {
      // Each node represents a gadget/shim that needs contacts
      const gadgetId = brand.gadgetId(node.id.toString());
      
      // Create contacts for the gadget's pins
      // This is simplified - in reality we'd look up the gadget's pinout
      const inputContactId = brand.contactId(`${gadgetId}:input`);
      const outputContactId = brand.contactId(`${gadgetId}:output`);
      
      // Register contacts with NumberLattice for numeric computation
      contactStore.registerContact(inputContactId, NumberLattice);
      contactStore.registerContact(outputContactId, NumberLattice);
    }
    
    // Initialize wires from realized graph
    for (const edge of Object.values(realized.edges)) {
      const wireId = brand.wireId(edge.id.toString());
      const fromContact = brand.contactId(`${edge.from.node}:${edge.from.pin}`);
      const toContact = brand.contactId(`${edge.to.node}:${edge.to.pin}`);
      
      contactStore.addConnection(wireId, fromContact, toContact);
    }
    
    // Mount gadgets into slots based on IR occupants
    for (const [slotId, gadgetIds] of Object.entries(ir.occupants)) {
      for (const gadgetId of gadgetIds) {
        const slot = ir.slots[slotId];
        if (!slot) continue;
        
        // Find gadget spec (simplified - would come from registry)
        const spec = {
          pinouts: [slot.requires],
          params: {}
        };
        
        // Create pin mappings
        const pinMappings = new Map();
        pinMappings.set(
          brand.pinId(`${gadgetId}:input`),
          brand.contactId(`${gadgetId}:input`)
        );
        pinMappings.set(
          brand.pinId(`${gadgetId}:output`),
          brand.contactId(`${gadgetId}:output`)
        );
        
        slotManager.mountGadget(slotId as SlotId, gadgetId, spec, pinMappings);
        
        // Register gadget instance if it's in our library
        const gadgetName = gadgetId.split('://')[1]?.split('/')[0];
        if (gadgetName) {
          const gadget = this.gadgetLibrary.get(gadgetName);
          if (gadget) {
            gadgetExecutor.registerGadget(gadgetId, gadget);
          }
        }
      }
    }
    
    // Create and store context
    const context: ExecutionContext = {
      boardId,
      ir,
      realized,
      contactStore,
      slotManager,
      propagationEngine,
      gadgetExecutor
    };
    
    this.contexts.set(boardId, context);
    
    if (this.config.enableDebugLogging) {
      console.log(`[GraphExecutor] Initialized board ${boardId}`);
      console.log(`  Contacts: ${contactStore.getStats().contactCount}`);
      console.log(`  Slots: ${slotManager.getStats().slotCount}`);
      console.log(`  Mounted gadgets: ${slotManager.getStats().mountedGadgetCount}`);
    }
    
    return context;
  }
  
  /**
   * Update a contact value and propagate
   */
  async updateContact(
    boardId: BoardId,
    contactId: ContactId,
    value: unknown
  ): Promise<void> {
    const context = this.contexts.get(boardId);
    if (!context) {
      throw new Error(`Board ${boardId} not initialized`);
    }
    
    const stats = await context.propagationEngine.propagate(contactId, value);
    
    if (this.config.enableDebugLogging) {
      console.log(`[GraphExecutor] Propagation complete for ${contactId}`);
      console.log(`  Tasks processed: ${stats.tasksProcessed}`);
      console.log(`  Values changed: ${stats.valuesChanged}`);
      console.log(`  Cycles detected: ${stats.cyclesDetected}`);
      console.log(`  Max depth: ${stats.propagationDepth}`);
      console.log(`  Duration: ${stats.duration.toFixed(2)}ms`);
    }
  }
  
  /**
   * Execute a specific gadget
   */
  async executeGadget(
    boardId: BoardId,
    gadgetId: GadgetId
  ): Promise<void> {
    const context = this.contexts.get(boardId);
    if (!context) {
      throw new Error(`Board ${boardId} not initialized`);
    }
    
    const execution = await context.gadgetExecutor.executeGadget(gadgetId);
    
    if (this.config.enableDebugLogging) {
      console.log(`[GraphExecutor] Executed gadget ${gadgetId}`);
      console.log(`  Executed: ${execution.executed}`);
      console.log(`  Duration: ${execution.duration.toFixed(2)}ms`);
      console.log(`  Inputs:`, Array.from(execution.inputValues.entries()));
      console.log(`  Outputs:`, Array.from(execution.outputValues.entries()));
    }
  }
  
  /**
   * Mount a gadget into a slot
   */
  async mountGadget(
    boardId: BoardId,
    slotId: SlotId,
    gadgetId: GadgetId,
    gadgetName: string
  ): Promise<void> {
    const context = this.contexts.get(boardId);
    if (!context) {
      throw new Error(`Board ${boardId} not initialized`);
    }
    
    // Get gadget from library
    const gadget = this.gadgetLibrary.get(gadgetName);
    if (!gadget) {
      throw new Error(`Gadget ${gadgetName} not found in library`);
    }
    
    // Get slot declaration
    const slot = context.ir.slots[slotId];
    if (!slot) {
      throw new Error(`Slot ${slotId} not found`);
    }
    
    // Create gadget spec
    const spec = {
      pinouts: [slot.requires],
      params: {}
    };
    
    // Create contacts for the gadget
    const pinMappings = new Map();
    for (const inputName of gadget.inputs) {
      const contactId = brand.contactId(`${gadgetId}:${inputName}`);
      const pinId = brand.pinId(`${gadgetId}:${inputName}`);
      context.contactStore.registerContact(contactId, NumberLattice);
      pinMappings.set(pinId, contactId);
    }
    
    for (const outputName of gadget.outputs) {
      const contactId = brand.contactId(`${gadgetId}:${outputName}`);
      const pinId = brand.pinId(`${gadgetId}:${outputName}`);
      context.contactStore.registerContact(contactId, NumberLattice);
      pinMappings.set(pinId, contactId);
    }
    
    // Mount in slot manager
    context.slotManager.mountGadget(slotId, gadgetId, spec, pinMappings);
    
    // Register in executor
    context.gadgetExecutor.registerGadget(gadgetId, gadget);
    
    if (this.config.enableDebugLogging) {
      console.log(`[GraphExecutor] Mounted gadget ${gadgetId} in slot ${slotId}`);
    }
  }
  
  /**
   * Unmount a gadget
   */
  async unmountGadget(
    boardId: BoardId,
    gadgetId: GadgetId
  ): Promise<void> {
    const context = this.contexts.get(boardId);
    if (!context) {
      throw new Error(`Board ${boardId} not initialized`);
    }
    
    const slotId = context.slotManager.unmountGadget(gadgetId);
    context.gadgetExecutor.unregisterGadget(gadgetId);
    
    if (this.config.enableDebugLogging) {
      console.log(`[GraphExecutor] Unmounted gadget ${gadgetId} from slot ${slotId}`);
    }
  }
  
  /**
   * Get execution context for a board
   */
  getContext(boardId: BoardId): ExecutionContext | undefined {
    return this.contexts.get(boardId);
  }
  
  /**
   * Get statistics for a board
   */
  getStats(boardId: BoardId) {
    const context = this.contexts.get(boardId);
    if (!context) {
      return null;
    }
    
    return {
      contacts: context.contactStore.getStats(),
      slots: context.slotManager.getStats(),
      propagation: context.propagationEngine.getStats(),
      executions: Array.from(context.gadgetExecutor.getAllStats().entries())
    };
  }
  
  /**
   * Cleanup a board's execution context
   */
  cleanup(boardId: BoardId): void {
    const context = this.contexts.get(boardId);
    if (context) {
      context.contactStore.clear();
      context.slotManager.clear();
      context.gadgetExecutor.clear();
      this.contexts.delete(boardId);
    }
  }
}