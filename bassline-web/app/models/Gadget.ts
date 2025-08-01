import type { UUID, Position, ContactGroup } from './types';
import { ContactGroupImpl } from './ContactGroup';
import { BoundaryContactImpl } from './BoundaryContact';
import { ContactGroupWireImpl } from './ContactGroupWire';
import { EventEmitter } from '../utils/EventEmitter';
import { DEFAULT_BLEND_MODE, NumericSum, NumericProduct } from './blendModes';
import { PrimitiveAdder, PrimitiveMultiplier, PrimitiveConstant } from './PrimitiveGadget';

export interface GadgetTemplate {
  id: string;
  name: string;
  category: string;
  icon?: string;
  description?: string;
  isPrimitive?: boolean;
  // Creates a new instance of this gadget (subgroup)
  instantiate: (position: Position, eventEmitter: EventEmitter) => ContactGroup;
}

// Helper to create a gadget (which is just a ContactGroup with boundary contacts)
export function createGadget(
  name: string,
  position: Position,
  eventEmitter: EventEmitter,
  setup: (group: ContactGroupImpl) => void
): ContactGroupImpl {
  const gadget = new ContactGroupImpl(
    crypto.randomUUID(),
    name,
    position,
    eventEmitter
  );
  
  setup(gadget);
  return gadget;
}

// Primitive gadget templates
export const PRIMITIVE_GADGETS: GadgetTemplate[] = [
  {
    id: 'adder',
    name: 'Adder',
    category: 'Math',
    icon: '➕',
    description: 'Adds two numbers together',
    isPrimitive: true,
    instantiate: (pos, emitter) => new PrimitiveAdder(pos, emitter)
  },
  
  {
    id: 'multiplier',
    name: 'Multiplier',
    category: 'Math',
    icon: '✖️',
    description: 'Multiplies two numbers',
    isPrimitive: true,
    instantiate: (pos, emitter) => new PrimitiveMultiplier(pos, emitter)
  },
  
  {
    id: 'constant',
    name: 'Constant',
    category: 'Input',
    icon: '🔢',
    description: 'Outputs a constant value',
    isPrimitive: true,
    instantiate: (pos, emitter) => new PrimitiveConstant(pos, emitter)
  }
];

// Example of a non-primitive composite gadget
export const COMPOSITE_GADGETS: GadgetTemplate[] = [
  {
    id: 'double-adder',
    name: 'Double Adder',
    category: 'Math',
    icon: '➕➕',
    description: 'Adds three numbers (a + b + c)',
    isPrimitive: false,
    instantiate: (pos, emitter) => createGadget('Double Adder', pos, emitter, (group) => {
      // Create boundary contacts for inputs
      const inputA = new BoundaryContactImpl(
        crypto.randomUUID(),
        { x: 20, y: 30 },
        DEFAULT_BLEND_MODE,
        emitter
      );
      const inputB = new BoundaryContactImpl(
        crypto.randomUUID(),
        { x: 20, y: 70 },
        DEFAULT_BLEND_MODE,
        emitter
      );
      
      // Create internal computation contact
      const computer = new ContactImpl(
        crypto.randomUUID(),
        { x: 100, y: 50 },
        new NumericSum(),
        emitter
      );
      
      // Create boundary contact for output
      const output = new BoundaryContactImpl(
        crypto.randomUUID(),
        { x: 180, y: 50 },
        DEFAULT_BLEND_MODE,
        emitter
      );
      
      // Add all contacts to the group
      group.addContact(inputA);
      group.addContact(inputB);
      group.addContact(computer);
      group.addContact(output);
      
      // Wire inputs to computer
      const wireA = new ContactGroupWireImpl(
        crypto.randomUUID(),
        inputA.id,
        computer.id,
        group.id,
        emitter
      );
      const wireB = new ContactGroupWireImpl(
        crypto.randomUUID(),
        inputB.id,
        computer.id,
        group.id,
        emitter
      );
      
      // Wire computer to output
      const wireOut = new ContactGroupWireImpl(
        crypto.randomUUID(),
        computer.id,
        output.id,
        group.id,
        emitter
      );
      
      group.addWire(wireA);
      group.addWire(wireB);
      group.addWire(wireOut);
    })
  },
  
  {
    id: 'multiplier',
    name: 'Multiplier',
    category: 'Math',
    icon: '✖️',
    description: 'Multiplies two numbers',
    instantiate: (pos, emitter) => createGadget('Multiplier', pos, emitter, (group) => {
      // Create boundary contacts for inputs
      const inputA = new BoundaryContactImpl(
        crypto.randomUUID(),
        { x: 20, y: 30 },
        DEFAULT_BLEND_MODE,
        emitter
      );
      const inputB = new BoundaryContactImpl(
        crypto.randomUUID(),
        { x: 20, y: 70 },
        DEFAULT_BLEND_MODE,
        emitter
      );
      
      // Create internal computation contact with product blend mode
      const computer = new ContactImpl(
        crypto.randomUUID(),
        { x: 100, y: 50 },
        new NumericProduct(),
        emitter
      );
      
      // Create boundary contact for output
      const output = new BoundaryContactImpl(
        crypto.randomUUID(),
        { x: 180, y: 50 },
        DEFAULT_BLEND_MODE,
        emitter
      );
      
      // Add all contacts to the group
      group.addContact(inputA);
      group.addContact(inputB);
      group.addContact(computer);
      group.addContact(output);
      
      // Wire inputs to computer
      const wireA = new ContactGroupWireImpl(
        crypto.randomUUID(),
        inputA.id,
        computer.id,
        group.id,
        emitter
      );
      const wireB = new ContactGroupWireImpl(
        crypto.randomUUID(),
        inputB.id,
        computer.id,
        group.id,
        emitter
      );
      
      // Wire computer to output
      const wireOut = new ContactGroupWireImpl(
        crypto.randomUUID(),
        computer.id,
        output.id,
        group.id,
        emitter
      );
      
      group.addWire(wireA);
      group.addWire(wireB);
      group.addWire(wireOut);
    })
  },
  
  {
    id: 'constant',
    name: 'Constant',
    category: 'Input',
    icon: '🔢',
    description: 'Outputs a constant value',
    instantiate: (pos, emitter) => createGadget('Constant', pos, emitter, (group) => {
      // Just a single boundary output with a preset value
      const output = new BoundaryContactImpl(
        crypto.randomUUID(),
        { x: 100, y: 50 },
        DEFAULT_BLEND_MODE,
        emitter
      );
      
      group.addContact(output);
      // User can right-click to set the value
      output.setContent(0);
    })
  }
];

// Import for ContactImpl
import { ContactImpl } from './Contact';

// Registry that can hold both primitive and user-defined gadgets
export class GadgetRegistry {
  private templates: Map<string, GadgetTemplate> = new Map();
  
  constructor() {
    // Load primitive gadgets
    PRIMITIVE_GADGETS.forEach(template => {
      this.templates.set(template.id, template);
    });
  }
  
  register(template: GadgetTemplate): void {
    this.templates.set(template.id, template);
  }
  
  registerFromGroup(group: ContactGroup, metadata: Partial<GadgetTemplate>): void {
    // Create a template from an existing group (user-defined gadget)
    const template: GadgetTemplate = {
      id: metadata.id || `user-${group.id}`,
      name: metadata.name || group.name,
      category: metadata.category || 'User Defined',
      icon: metadata.icon,
      description: metadata.description,
      instantiate: (pos, emitter) => {
        // Deep clone the group structure
        // TODO: Implement proper group cloning
        return createGadget(group.name, pos, emitter, (newGroup) => {
          // Clone all contacts and wires from the original group
          // This would need to properly map boundary contacts
        });
      }
    };
    
    this.register(template);
  }
  
  getAll(): GadgetTemplate[] {
    return Array.from(this.templates.values());
  }
  
  getByCategory(): Map<string, GadgetTemplate[]> {
    const byCategory = new Map<string, GadgetTemplate[]>();
    
    this.templates.forEach(template => {
      const category = template.category;
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)!.push(template);
    });
    
    return byCategory;
  }
}