// protocols.ts - Properly typed

import _ from 'lodash';

// Core types
export type Value<T = unknown> = { value: T };
    // export type Assertion = { 
    // id: string;
    // kind: 'need' | 'have';
    // tag: string;
    // source: string;
    // };

// Effect types
export type Effect = 
  | { type: 'propagate'; value: Value<any> }
  | { type: 'assert'; assertion: Assertion }
  | { type: 'log'; message: string };

// Protocol with proper generics
export interface Protocol<TIn = unknown, TResult = unknown> {
  apply: (data: TIn) => TResult | null;
  consider: (result: TResult) => Effect | Effect[] | null;
  act: (effect: Effect) => void;
}

// Type guards
export const isValue = <T>(data: unknown): data is Value<T> => 
  data != null && typeof data === 'object' && 'value' in data;

export const isAssertion = (data: unknown): data is Assertion =>
  data != null && typeof data === 'object' && 'kind' in data && 'tag' in data;

// Cell protocol with proper types
export function cellProtocol<T>(
  merge: (old: T, incoming: T) => T,
  initial: T
): Protocol<Value<T>, { old: T; new: T; changed: boolean }> {
  let state = initial;
  
  return {
    apply: (data: Value<T>) => {
      const old = state;
      state = merge(old, data.value);
      return { old, new: state, changed: !_.isEqual(state, old) };
    },
    consider: (result) => {
      if (result.changed) {
        return { type: 'propagate', value: { value: result.new } };
      }
      return null;
    },
    act: () => {}
  };
}

// Function protocol
export function fnProtocol<TIn, TOut>(
  transform: (input: TIn) => TOut | null
): Protocol<Value<TIn>, TOut> {
  return {
    apply: (data: Value<TIn>) => transform(data.value),
    consider: (result) => 
      result != null ? { type: 'propagate', value: { value: result } } : null,
    act: () => {}
  };
}

// Gadget that can handle multiple protocol types
export class Gadget extends EventTarget {
  private protocols: Protocol<any, any>[] = [];
  private dataHandlers = new Map<string, (data: any) => void>();
  
  constructor(public readonly id = _.uniqueId('gadget-')) {
    super();
  }

  receive<T>(data: T): void {
    // Try each protocol
    this.protocols.forEach(protocol => {
      // Check if this protocol can handle the data
      const result = protocol.apply(data);
      if (result == null) return;
      
      const effects = protocol.consider(result);
      if (!effects) return;
      
      const effectArray = Array.isArray(effects) ? effects : [effects];
      effectArray.forEach(effect => {
        this.handleEffect(effect);
        protocol.act(effect);
      });
    });
    
    // Also check typed handlers
    const type = (data as any)?.type;
    if (type && this.dataHandlers.has(type)) {
      this.dataHandlers.get(type)!(data);
    }
  }

  use<TIn, TResult>(protocol: Protocol<TIn, TResult>): this {
    this.protocols.push(protocol);
    return this;
  }
  
  on<T>(type: string, handler: (data: T) => void): this {
    this.dataHandlers.set(type, handler);
    return this;
  }

  private handleEffect(effect: Effect): void {
    switch (effect.type) {
      case 'propagate':
        this.emit('propagate', effect.value);
        break;
      case 'assert':
        this.emit('assert', effect.assertion);
        break;
      case 'log':
        console.log(`[${this.id}]:`, effect.message);
        break;
    }
  }

  emit(event: string, data: unknown): void {
    this.dispatchEvent(new CustomEvent(event, { detail: data }));
  }
}

// Properly typed builders
export class GadgetBuilder {
  static cell<T>(
    id: string,
    merge: (old: T, incoming: T) => T,
    initial: T
  ): Gadget {
    return new Gadget(id).use(cellProtocol(merge, initial));
  }
  
  static fn<TIn, TOut>(
    id: string,
    transform: (input: TIn) => TOut | null
  ): Gadget {
    return new Gadget(id).use(fnProtocol(transform));
  }
}

// Example usage with proper types
function createTypedNetwork() {
  // Temperature types
  type Temperature = { celsius?: number; fahrenheit?: number; kelvin?: number };
  
  const tempConverter = new Gadget('converter')
    .use<Value<Temperature>, Temperature>({
      apply: (data) => isValue<Temperature>(data) ? data.value : null,
      consider: (temp) => {
        const effects: Effect[] = [];
        
        if (temp.celsius !== undefined) {
          effects.push({
            type: 'propagate',
            value: { value: { fahrenheit: temp.celsius * 9/5 + 32 } }
          });
        }
        if (temp.fahrenheit !== undefined) {
          effects.push({
            type: 'propagate', 
            value: { value: { celsius: (temp.fahrenheit - 32) * 5/9 } }
          });
        }
        
        return effects;
      },
      act: () => {}
    });
  
  // Number cell with proper types
  const sumCell = GadgetBuilder.cell('sum', 
    (a: number, b: number) => a + b,
    0
  );
  
  // Transform function with types
  const doubler = GadgetBuilder.fn('double',
    (x: number) => x * 2
  );
  
  return { tempConverter, sumCell, doubler };
}






















export interface Assertion {
    id: string;
    kind: 'need' | 'have';
    tag: string;
    source: string;
    metadata?: Record<string, any>;
  }
  
  export type PoolMessage = 
    | { type: 'register'; gadget: Gadget }
    | { type: 'assert'; assertion: Assertion }
    | { type: 'retract'; assertion: Assertion }
    | { type: 'query'; tag: string };
  
  export interface Match {
    need: Assertion;
    have: Assertion;
    confidence: number;
  }
  
  export class Pool extends Gadget {
    private assertions = new Map<string, Set<Assertion>>();
    private gadgets = new Map<string, Gadget>();
    private wires = new Set<string>();
    
    constructor(id = 'pool') {
      super(id);
      this.use(this.poolProtocol());
      this.use(this.registrationProtocol());
    }
    
    // Main pool protocol for handling assertions
    private poolProtocol(): Protocol<PoolMessage, Match[]> {
      return {
        apply: (msg: PoolMessage) => {
          switch (msg.type) {
            case 'assert':
              return this.processAssertion(msg.assertion);
            case 'retract':
              return this.processRetraction(msg.assertion);
            case 'query':
              return this.queryTag(msg.tag);
            default:
              return null;
          }
        },
        
        consider: (matches: Match[]) => {
          if (matches.length === 0) return null;
          
          // Create wiring effects for each match
          const effects: Effect[] = matches.map(match => ({
            type: 'log',
            message: `Match found: ${match.have.source} → ${match.need.source} (confidence: ${match.confidence})`
          }));
          
          // Actually wire them
          matches.forEach(match => this.wire(match));
          
          return effects;
        },
        
        act: () => {} // Gadget handles effects
      };
    }
    
    // Protocol for registering gadgets
    private registrationProtocol(): Protocol<PoolMessage, boolean> {
      return {
        apply: (msg: PoolMessage) => {
          if (msg.type === 'register') {
            return this.registerGadget(msg.gadget);
          }
          return null;
        },
        
        consider: (registered: boolean) => {
          if (registered) {
            return { 
              type: 'log', 
              message: `Gadget registered with pool` 
            };
          }
          return null;
        },
        
        act: () => {}
      };
    }
    
    // Register a gadget and listen to its assertions
    private registerGadget(gadget: Gadget): boolean {
      if (this.gadgets.has(gadget.id)) return false;
      
      this.gadgets.set(gadget.id, gadget);
      
      // Listen for assertions from the gadget
      gadget.addEventListener('assert', (e: Event) => {
        const assertion = (e as CustomEvent).detail as Assertion;
        this.receive({ type: 'assert', assertion });
      });
      
      // Listen for retractions
      gadget.addEventListener('retract', (e: Event) => {
        const assertion = (e as CustomEvent).detail as Assertion;
        this.receive({ type: 'retract', assertion });
      });
      
      return true;
    }
    
    // Process an assertion and find matches
    private processAssertion(assertion: Assertion): Match[] {
      // Store the assertion
      const group = this.assertions.get(assertion.tag) || new Set();
      group.add(assertion);
      this.assertions.set(assertion.tag, group);
      
      // Find matches
      return this.findMatches(assertion);
    }
    
    // Process a retraction
    private processRetraction(assertion: Assertion): Match[] {
      const group = this.assertions.get(assertion.tag);
      if (!group) return [];
      
      // Remove the assertion
      const toRemove = Array.from(group).find(
        a => a.id === assertion.id && a.source === assertion.source
      );
      
      if (toRemove) {
        group.delete(toRemove);
        
        // If this was the last assertion for this tag, clean up
        if (group.size === 0) {
          this.assertions.delete(assertion.tag);
        }
      }
      
      return []; // No new matches from retraction
    }
    
    // Query all assertions for a tag
    private queryTag(tag: string): Match[] {
      const assertions = this.assertions.get(tag);
      if (!assertions) return [];
      
      const needs = Array.from(assertions).filter(a => a.kind === 'need');
      const haves = Array.from(assertions).filter(a => a.kind === 'have');
      
      // Generate all possible matches
      const matches: Match[] = [];
      for (const need of needs) {
        for (const have of haves) {
          matches.push({
            need,
            have,
            confidence: this.calculateConfidence(need, have)
          });
        }
      }
      
      return matches;
    }
    
    // Find matches for a new assertion
    private findMatches(assertion: Assertion): Match[] {
      const allAssertions: Assertion[] = Array.from(this.assertions.get(assertion.tag) || new Set());
      
      if (assertion.kind === 'need') {
        // Find all haves that match this need
        return allAssertions
          .filter(a => a.kind === 'have')
          .map(have => ({
            need: assertion,
            have,
            confidence: this.calculateConfidence(assertion, have)
          }));
      } else {
        // Find all needs that match this have
        return allAssertions
          .filter(a => a.kind === 'need')
          .map(need => ({
            need,
            have: assertion,
            confidence: this.calculateConfidence(need, assertion)
          }));
      }
    }
    
    // Calculate match confidence based on metadata
    private calculateConfidence(need: Assertion, have: Assertion): number {
      let confidence = 1.0;
      
      // Exact tag match
      if (need.tag === have.tag) {
        confidence = 1.0;
      }
      
      // Check metadata compatibility if present
      if (need.metadata && have.metadata) {
        const commonKeys = _.intersection(
          Object.keys(need.metadata),
          Object.keys(have.metadata)
        );
        
        commonKeys.forEach(key => {
          if (_.isEqual(need.metadata![key], have.metadata![key])) {
            confidence *= 1.1; // Boost for matching metadata
          } else {
            confidence *= 0.9; // Penalty for mismatched metadata
          }
        });
      }
      
      return Math.min(confidence, 1.0); // Cap at 1.0
    }
    
    // Create actual wire between gadgets
    private wire(match: Match): void {
      const wireId = `${match.have.source}->${match.need.source}:${match.have.tag}`;
      
      // Don't create duplicate wires
      if (this.wires.has(wireId)) return;
      
      const provider = this.gadgets.get(match.have.source);
      const consumer = this.gadgets.get(match.need.source);
      
      if (!provider || !consumer) {
        console.warn(`Cannot wire: gadget not found`);
        return;
      }
      
      // Create the wire through event listener
      const handler = (e: Event) => {
        const data = (e as CustomEvent).detail;
        // Tag the data with the wire info for debugging
        consumer.receive({
          ...data,
          _via: wireId,
          _confidence: match.confidence
        });
      };
      
      provider.addEventListener('propagate', handler);
      this.wires.add(wireId);
      
      // Emit wiring event
      this.emit('wired', {
        from: match.have.source,
        to: match.need.source,
        tag: match.have.tag,
        confidence: match.confidence
      });
    }
    
    // Public API
    register(gadget: Gadget): void {
      this.receive({ type: 'register', gadget });
    }
    
    query(tag: string): void {
      this.receive({ type: 'query', tag });
    }
  }
  
  // Helper functions for creating assertions
  export const need = (tag: string, source: string, metadata?: Record<string, any>): Assertion => ({
    id: _.uniqueId('need-'),
    kind: 'need',
    tag,
    source,
    metadata
  });
  
  export const have = (tag: string, source: string, metadata?: Record<string, any>): Assertion => ({
    id: _.uniqueId('have-'),
    kind: 'have',
    tag,
    source,
    metadata
  });

















// Helper for colored console output
const log = {
  gadget: (id: string, msg: string) => console.log(`  [${id}]`, msg),
  flow: (msg: string) => console.log(`→ ${msg}`),
  effect: (msg: string) => console.log(`  ✓ ${msg}`),
  wire: (from: string, to: string) => console.log(`  🔗 ${from} → ${to}`),
  section: (title: string) => console.log(`\n${'='.repeat(50)}\n${title}\n${'='.repeat(50)}`)
};

// Create a logged protocol wrapper
function loggedProtocol<TIn, TResult>(
  name: string,
  protocol: Protocol<TIn, TResult>
): Protocol<TIn, TResult> {
  return {
    apply: (data: TIn) => {
      log.gadget(name, `APPLY: ${JSON.stringify(data)}`);
      const result = protocol.apply(data);
      if (result !== null) {
        log.gadget(name, `  → result: ${JSON.stringify(result)}`);
      }
      return result;
    },
    consider: (result: TResult) => {
      log.gadget(name, `CONSIDER: ${JSON.stringify(result)}`);
      const effects = protocol.consider(result);
      if (effects) {
        const effectArray = Array.isArray(effects) ? effects : [effects];
        effectArray.forEach(e => 
          log.gadget(name, `  → effect: ${e.type}`)
        );
      }
      return effects;
    },
    act: (effect: Effect) => {
      log.gadget(name, `ACT: ${effect.type}`);
      protocol.act(effect);
    }
  };
}

// Test 1: Basic propagation chain
function testBasicPropagation() {
  log.section('Test 1: Basic Propagation Chain');
  
  const pool = new Pool();
  
  // Source that generates values
  const source = new Gadget('source');
  source.use(loggedProtocol('source', {
    apply: (data: any) => {
      if (data.type === 'generate') {
        return { value: data.amount };
      }
      return null;
    },
    consider: (result: any) => ({
      type: 'propagate',
      value: { value: result.value }
    }),
    act: () => {}
  }));
  
  // Doubler
  const doubler = new Gadget('doubler');
  doubler.use(loggedProtocol('doubler', {
    apply: (data: any) => {
      if (isValue<number>(data)) {
        return data.value * 2;
      }
      return null;
    },
    consider: (result: number) => ({
      type: 'propagate',
      value: { value: result }
    }),
    act: () => {}
  }));
  
  // Accumulator
  let accValue = 0;
  const accumulator = new Gadget('accumulator');
  accumulator.use(loggedProtocol('accumulator', {
    apply: (data: any) => {
      if (isValue<number>(data)) {
        const old = accValue;
        accValue += data.value;
        return { old, new: accValue };
      }
      return null;
    },
    consider: (result: any) => {
      log.effect(`Accumulated: ${result.old} + input = ${result.new}`);
      return null; // Don't propagate further
    },
    act: () => {}
  }));
  
  // Manual wiring with logging
  source.addEventListener('propagate', (e) => {
    const data = (e as CustomEvent).detail;
    log.flow(`source → doubler: ${JSON.stringify(data)}`);
    doubler.receive(data);
  });
  
  doubler.addEventListener('propagate', (e) => {
    const data = (e as CustomEvent).detail;
    log.flow(`doubler → accumulator: ${JSON.stringify(data)}`);
    accumulator.receive(data);
  });
  
  // Run test
  console.log('\nGenerating value 5:');
  source.receive({ type: 'generate', amount: 5 });
  
  console.log('\nGenerating value 10:');
  source.receive({ type: 'generate', amount: 10 });
}

// Test 2: Pool-based automatic wiring
function testPoolWiring() {
  log.section('Test 2: Pool-Based Automatic Wiring');
  
  const pool = new Pool();
  
  // Create gadgets with semantic tags
  const tempSensor = new Gadget('temp-sensor');
  const tempDisplay = new Gadget('temp-display');
  const tempLogger = new Gadget('temp-logger');
  
  // Register with pool
  pool.register(tempSensor);
  pool.register(tempDisplay);
  pool.register(tempLogger);
  
  // Add behaviors
  tempSensor.use(loggedProtocol('temp-sensor', {
    apply: (data: any) => {
      if (data.type === 'read') {
        return 20 + Math.random() * 10;
      }
      return null;
    },
    consider: (temp: number) => ({
      type: 'propagate',
      value: { value: temp }
    }),
    act: () => {}
  }));
  
  tempDisplay.use(loggedProtocol('temp-display', {
    apply: (data: any) => {
      if (isValue<number>(data)) {
        return `Display: ${data.value.toFixed(1)}°C`;
      }
      return null;
    },
    consider: (display: string) => {
      log.effect(display);
      return null;
    },
    act: () => {}
  }));
  
  tempLogger.use(loggedProtocol('temp-logger', {
    apply: (data: any) => {
      if (isValue<number>(data)) {
        return { timestamp: Date.now(), temp: data.value };
      }
      return null;
    },
    consider: (record: any) => {
      log.effect(`Logged: ${record.temp}°C at ${new Date(record.timestamp).toISOString()}`);
      return null;
    },
    act: () => {}
  }));
  
  // Listen for pool wiring events
  pool.addEventListener('wired', (e) => {
    const { from, to } = (e as CustomEvent).detail;
    log.wire(from, to);
  });
  
  // Semantic assertions trigger wiring
  console.log('\nAsserting needs and provides:');
  tempSensor.emit('assert', have('temperature', 'temp-sensor'));
  tempDisplay.emit('assert', need('temperature', 'temp-display'));
  tempLogger.emit('assert', need('temperature', 'temp-logger'));
  
  // Test propagation
  console.log('\nReading temperature:');
  tempSensor.receive({ type: 'read' });

  tempDisplay.receive({ type: 'display' });
}

// Test 3: Cycles with convergence
function testCycles() {
  log.section('Test 3: Cycles with Convergence');

  const pool = new Pool();
  
  // Two gadgets that influence each other
  const gadgetA = new Gadget('A');
  const gadgetB = new Gadget('B');

  pool.register(gadgetA);
  pool.register(gadgetB);
  
  let valueA = 10;
  let valueB = 20;
  let iterationA = 0;
  let iterationB = 0;
  
  gadgetA.use(loggedProtocol('A', {
    apply: (data: any) => {
      if (isValue<number>(data)) {
        iterationA++;
        const old = valueA;
        // Move towards B's value
        valueA = (valueA + data.value) / 2;
        return { old, new: valueA, iteration: iterationA };
      }
      return null;
    },
    consider: (result: any) => {
      if (Math.abs(result.new - result.old) > 0.01) {
        return { type: 'propagate', value: { value: result.new } };
      }
      log.effect(`A converged at ${result.new} after ${result.iteration} iterations`);
      return null;
    },
    act: () => {}
  }));
  
  gadgetB.use(loggedProtocol('B', {
    apply: (data: any) => {
      if (isValue<number>(data)) {
        iterationB++;
        const old = valueB;
        // Move towards A's value
        valueB = (valueB + data.value) / 2;
        return { old, new: valueB, iteration: iterationB };
      }
      return null;
    },
    consider: (result: any) => {
      if (Math.abs(result.new - result.old) > 0.01) {
        return { type: 'propagate', value: { value: result.new } };
      }
      log.effect(`B converged at ${result.new} after ${result.iteration} iterations`);
      return null;
    },
    act: () => {}
  }));

  // Listen for pool wiring events
  pool.addEventListener('wired', (e) => {
    const { from, to } = (e as CustomEvent).detail;
    log.wire(from, to);
  });

  gadgetA.emit('assert', have('goodValue', 'A'));
  gadgetA.emit('assert', need('goodValue', 'A'));
  gadgetB.emit('assert', need('goodValue', 'B'));
  gadgetA.emit('assert', have('goodValue', 'B'));
  
  console.log('\nStarting values: A=10, B=20');
  console.log('Kicking off convergence:');

  gadgetA.receive({ value: valueB });
}

// Run all tests
testBasicPropagation();
setTimeout(() => testPoolWiring(), 100);
setTimeout(() => testCycles(), 1000);

const a = new Gadget('a')
    .use(cellProtocol((a, b) => {return Math.max(a, b);}, 0));

const b = new Gadget('b')
    .use(cellProtocol((a, b) => {return Math.max(a, b);}, 0));

const c = new Gadget('c')
    .use(cellProtocol((a, b) => {return Math.max(a, b);}, 0));

const adder = GadgetBuilder
    .fn('adder', (a: number, b: number) => {return a + b});