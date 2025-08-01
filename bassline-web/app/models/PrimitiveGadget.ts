import type { UUID, Position, Contact, ContactGroup } from './types';
import { ContactGroupImpl } from './ContactGroup';
import { ContactImpl } from './Contact';
import { BoundaryContactImpl } from './BoundaryContact';
import { EventEmitter } from '../utils/EventEmitter';
import { DEFAULT_BLEND_MODE } from './blendModes';

// Mark a contact as input-only or output-only
export class InputOnlyContact extends BoundaryContactImpl {
  canConnectFrom(): boolean {
    return false; // Cannot be a source
  }
}

export class OutputOnlyContact extends BoundaryContactImpl {
  canConnectTo(): boolean {
    return false; // Cannot be a target
  }
}

// Base class for primitive gadgets - atomic, non-inspectable units
export abstract class PrimitiveGadget extends ContactGroupImpl {
  private inputs: Map<string, InputOnlyContact> = new Map();
  private outputs: Map<string, OutputOnlyContact> = new Map();
  private isRunning = false;
  
  constructor(
    id: UUID,
    name: string,
    position: Position,
    eventEmitter: EventEmitter
  ) {
    super(id, name, position, eventEmitter);
    
    // Listen for input changes
    this.eventEmitter.on('ContactContentChanged', (event) => {
      if (this.inputs.has(event.source.id)) {
        this.maybeRun();
      }
    });
  }
  
  // Mark as non-expandable
  isAtomic(): boolean {
    return true;
  }
  
  protected addInput(name: string, position: Position): InputOnlyContact {
    const input = new InputOnlyContact(
      crypto.randomUUID(),
      position,
      DEFAULT_BLEND_MODE,
      this.eventEmitter
    );
    this.inputs.set(name, input);
    this.addContact(input);
    return input;
  }
  
  protected addOutput(name: string, position: Position): OutputOnlyContact {
    const output = new OutputOnlyContact(
      crypto.randomUUID(),
      position,
      DEFAULT_BLEND_MODE,
      this.eventEmitter
    );
    this.outputs.set(name, output);
    this.addContact(output);
    return output;
  }
  
  protected getInput(name: string): any {
    const input = this.inputs.get(name);
    return input?.content?.value;
  }
  
  protected setOutput(name: string, value: any): void {
    const output = this.outputs.get(name);
    if (output) {
      output.setContent(value);
    }
  }
  
  private shouldRun(): boolean {
    // Check if all inputs have values
    for (const input of this.inputs.values()) {
      if (input.content === null || input.content.value === undefined) {
        return false;
      }
    }
    return true;
  }
  
  private maybeRun(): void {
    if (this.isRunning) return; // Prevent infinite loops
    
    if (this.shouldRun()) {
      this.isRunning = true;
      try {
        this.run();
      } finally {
        this.isRunning = false;
      }
    }
  }
  
  // Abstract method - subclasses implement their computation
  protected abstract run(): void;
}

// Concrete primitive gadgets

export class PrimitiveAdder extends PrimitiveGadget {
  constructor(position: Position, eventEmitter: EventEmitter) {
    super(crypto.randomUUID(), '➕', position, eventEmitter);
    
    this.addInput('a', { x: 0, y: 15 });
    this.addInput('b', { x: 0, y: 35 });
    this.addOutput('sum', { x: 50, y: 25 });
  }
  
  protected run(): void {
    const a = this.getInput('a');
    const b = this.getInput('b');
    
    if (typeof a === 'number' && typeof b === 'number') {
      this.setOutput('sum', a + b);
    }
  }
}

export class PrimitiveMultiplier extends PrimitiveGadget {
  constructor(position: Position, eventEmitter: EventEmitter) {
    super(crypto.randomUUID(), '✖️', position, eventEmitter);
    
    this.addInput('a', { x: 0, y: 15 });
    this.addInput('b', { x: 0, y: 35 });
    this.addOutput('product', { x: 50, y: 25 });
  }
  
  protected run(): void {
    const a = this.getInput('a');
    const b = this.getInput('b');
    
    if (typeof a === 'number' && typeof b === 'number') {
      this.setOutput('product', a * b);
    }
  }
}

export class PrimitiveConstant extends PrimitiveGadget {
  private value: any = 0;
  
  constructor(position: Position, eventEmitter: EventEmitter, initialValue: any = 0) {
    super(crypto.randomUUID(), '🔢', position, eventEmitter);
    
    this.value = initialValue;
    this.addOutput('value', { x: 50, y: 25 });
    
    // Immediately output the value
    this.run();
  }
  
  setValue(value: any): void {
    this.value = value;
    this.run();
  }
  
  protected run(): void {
    this.setOutput('value', this.value);
  }
}