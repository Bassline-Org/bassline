import { z } from 'zod';
import { 
  SlotId, 
  GadgetId, 
  PinId,
  ContactId,
  WireId,
  SlotDecl,
  GadgetSpec,
  WireEndpoint,
  brand
} from '../core/types';
import type { ValidatedLattice } from '../core/lattice';

/**
 * Slot manager - handles mounting and unmounting gadgets into board slots.
 * Enforces slot constraints and manages the mapping between slots and gadgets.
 */

export interface MountedGadget {
  slotId: SlotId;
  gadgetId: GadgetId;
  spec: GadgetSpec;
  mountedAt: number; // Timestamp
  pinMappings: Map<PinId, ContactId>; // Maps gadget pins to contact IDs
}

export interface SlotOccupancy {
  slot: SlotDecl;
  occupants: GadgetId[];
  maxCapacity: number;
}

export class SlotManager {
  private slots = new Map<SlotId, SlotOccupancy>();
  private mountedGadgets = new Map<GadgetId, MountedGadget>();
  private slotToGadgets = new Map<SlotId, Set<GadgetId>>();
  private mountListeners = new Set<(slotId: SlotId, gadgetId: GadgetId, mounted: boolean) => void>();
  
  constructor() {}
  
  /**
   * Register a slot with its declaration
   */
  registerSlot(slot: SlotDecl): void {
    if (this.slots.has(slot.id)) {
      throw new Error(`Slot ${slot.id} already registered`);
    }
    
    const capacity = slot.mode?.capacity ?? 1;
    this.slots.set(slot.id, {
      slot,
      occupants: [],
      maxCapacity: capacity
    });
    
    this.slotToGadgets.set(slot.id, new Set());
  }
  
  /**
   * Mount a gadget into a slot
   */
  mountGadget(
    slotId: SlotId,
    gadgetId: GadgetId,
    spec: GadgetSpec,
    pinMappings?: Map<PinId, ContactId>
  ): void {
    const slotOccupancy = this.slots.get(slotId);
    if (!slotOccupancy) {
      throw new Error(`Slot ${slotId} not found`);
    }
    
    // Check capacity
    if (slotOccupancy.occupants.length >= slotOccupancy.maxCapacity) {
      throw new Error(`Slot ${slotId} is at capacity (${slotOccupancy.maxCapacity})`);
    }
    
    // Check if gadget is already mounted
    if (this.mountedGadgets.has(gadgetId)) {
      throw new Error(`Gadget ${gadgetId} is already mounted`);
    }
    
    // Validate pinout compatibility
    const requiredPinout = slotOccupancy.slot.requires;
    const gadgetPinouts = spec.pinouts || [];
    
    if (!gadgetPinouts.includes(requiredPinout)) {
      throw new Error(
        `Gadget ${gadgetId} does not provide required pinout ${requiredPinout}`
      );
    }
    
    // Create mount record
    const mount: MountedGadget = {
      slotId,
      gadgetId,
      spec,
      mountedAt: Date.now(),
      pinMappings: pinMappings || new Map()
    };
    
    // Update state
    this.mountedGadgets.set(gadgetId, mount);
    slotOccupancy.occupants.push(gadgetId);
    
    const slotGadgets = this.slotToGadgets.get(slotId)!;
    slotGadgets.add(gadgetId);
    
    // Notify listeners
    for (const listener of this.mountListeners) {
      listener(slotId, gadgetId, true);
    }
  }
  
  /**
   * Unmount a gadget from its slot
   */
  unmountGadget(gadgetId: GadgetId): SlotId | undefined {
    const mount = this.mountedGadgets.get(gadgetId);
    if (!mount) {
      return undefined;
    }
    
    const slotOccupancy = this.slots.get(mount.slotId);
    if (slotOccupancy) {
      // Remove from occupants
      const index = slotOccupancy.occupants.indexOf(gadgetId);
      if (index >= 0) {
        slotOccupancy.occupants.splice(index, 1);
      }
      
      // Remove from slot mapping
      const slotGadgets = this.slotToGadgets.get(mount.slotId);
      if (slotGadgets) {
        slotGadgets.delete(gadgetId);
      }
    }
    
    // Remove mount record
    this.mountedGadgets.delete(gadgetId);
    
    // Notify listeners
    for (const listener of this.mountListeners) {
      listener(mount.slotId, gadgetId, false);
    }
    
    return mount.slotId;
  }
  
  /**
   * Get all gadgets mounted in a slot
   */
  getSlotOccupants(slotId: SlotId): GadgetId[] {
    const occupancy = this.slots.get(slotId);
    return occupancy ? [...occupancy.occupants] : [];
  }
  
  /**
   * Get mount information for a gadget
   */
  getMountInfo(gadgetId: GadgetId): MountedGadget | undefined {
    return this.mountedGadgets.get(gadgetId);
  }
  
  /**
   * Check if a slot has capacity for more gadgets
   */
  hasCapacity(slotId: SlotId): boolean {
    const occupancy = this.slots.get(slotId);
    if (!occupancy) return false;
    return occupancy.occupants.length < occupancy.maxCapacity;
  }
  
  /**
   * Resolve a wire endpoint to actual contact IDs
   * Handles both slot-based and direct gadget references
   */
  resolveEndpoint(endpoint: WireEndpoint): ContactId[] {
    const contactIds: ContactId[] = [];
    
    if (endpoint.slot) {
      // Get all gadgets in the slot
      const gadgetIds = this.getSlotOccupants(endpoint.slot);
      
      for (const gadgetId of gadgetIds) {
        const mount = this.mountedGadgets.get(gadgetId);
        if (mount) {
          // Find the contact for the specified pin
          const pinId = brand.pinId(`${gadgetId}:${endpoint.pin}`);
          const contactId = mount.pinMappings.get(pinId);
          if (contactId) {
            contactIds.push(contactId);
          }
        }
      }
    } else if (endpoint.gadget) {
      // Direct gadget reference
      const mount = this.mountedGadgets.get(endpoint.gadget);
      if (mount) {
        const pinId = brand.pinId(`${endpoint.gadget}:${endpoint.pin}`);
        const contactId = mount.pinMappings.get(pinId);
        if (contactId) {
          contactIds.push(contactId);
        }
      }
    }
    
    return contactIds;
  }
  
  /**
   * Subscribe to mount/unmount events
   */
  onMountChange(
    listener: (slotId: SlotId, gadgetId: GadgetId, mounted: boolean) => void
  ): () => void {
    this.mountListeners.add(listener);
    return () => this.mountListeners.delete(listener);
  }
  
  /**
   * Get statistics
   */
  getStats() {
    let totalOccupancy = 0;
    let totalCapacity = 0;
    
    for (const occupancy of this.slots.values()) {
      totalOccupancy += occupancy.occupants.length;
      totalCapacity += occupancy.maxCapacity;
    }
    
    return {
      slotCount: this.slots.size,
      mountedGadgetCount: this.mountedGadgets.size,
      totalOccupancy,
      totalCapacity,
      utilizationRate: totalCapacity > 0 ? totalOccupancy / totalCapacity : 0
    };
  }
  
  /**
   * Clear all data
   */
  clear(): void {
    this.slots.clear();
    this.mountedGadgets.clear();
    this.slotToGadgets.clear();
    this.mountListeners.clear();
  }
}