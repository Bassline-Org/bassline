import _ from 'lodash';
import type { INeed, IHave, AssertionKind, IAssertion as Assertion } from './pool';

export type Value<T = unknown> = { value: T };

// Constructors
export const value = <T>(v: T): Value<T> => ({ value: v });
export const need = (tag: string, source: string): INeed => 
  ({ id: _.uniqueId('need-'), kind: 'need', tag, source });
export const have = (tag: string, source: string): IHave => 
  ({ id: _.uniqueId('have-'), kind: 'have', tag, source });

// Guards using lodash
export const isValue = _.conforms({ value: _.isObject });
export const isAssertion = _.conforms({
  kind: (k: AssertionKind) => k === 'need' || k === 'have',
  tag: _.isString,
  source: _.isString 
});

export function protocol<T>(
  apply: (data: unknown) => T | null,
  consider: (result: T) => unknown | null,
  act: (decision: unknown) => void
): (data: unknown) => void {
  return _.flow([
    apply,
    (result: T | null) => result !== null ? consider(result) : null,
    (decision) => decision !== null ? act(decision) : null
  ]);
}

// Cell using lodash
export function cell<T>(
  merge: (old: T, incoming: T) => T,
  initial: T
) {
  let state = initial;
  
  return _.cond([
    [isValue, (data: Value<T>) => {
      const old = state;
      state = merge(old, data.value);
      if (!_.isEqual(state, old)) {
        return { type: 'propagate', value: state };
      }
    }],
    [_.stubTrue, _.noop as any]
  ]);
}

export class Gadget extends EventTarget {
    private protocols: Array<(data: unknown) => void> = [];
    
    constructor(public readonly id = _.uniqueId('gadget-')) {
      super();
    }
  
    receive(data: unknown): void {
      _.forEach(this.protocols, protocol => {
        const effect = protocol(data);
        if (effect) this.handleEffect(effect);
      });
    }
  
    use(protocol: (data: unknown) => any): this {
      this.protocols.push(protocol);
      return this;
    }
  
    private handleEffect(effect: any): void {
      if (!effect) return;
      
      if (effect.type === 'propagate') {
        this.emit('propagate', effect.value);
      } else if (effect.type === 'assert') {
        this.emit('assert', effect.assertion);
      }
    }
  
    emit(event: string, data: unknown): void {
      this.dispatchEvent(new CustomEvent(event, { detail: data }));
    }
  }
  
  export class Pool extends EventTarget {
    private assertions = new Map<string, Set<Assertion>>();
    private gadgets = new Map<string, Gadget>();
    private wires = new Set<string>(); // Track what's wired to prevent duplicates
  
    register(gadget: Gadget): void {
      this.gadgets.set(gadget.id, gadget);
      
      // Listen for assertions from this gadget
      gadget.addEventListener('assert', (e: Event) => {
        const assertion = (e as CustomEvent).detail;
        this.processAssertion(assertion);
      });
    }
  
    private processAssertion(assertion: Assertion): void {
      // Store assertion
      const group = this.assertions.get(assertion.tag) || new Set();
      group.add(assertion);
      this.assertions.set(assertion.tag, group);
      
      // Find matches and wire them up
      const matches = this.findMatches(assertion);
      matches.forEach(match => this.wire(match));
    }
  
    private findMatches(assertion: Assertion): Array<{need: Assertion, have: Assertion}> {
      const allAssertions = Array.from(this.assertions.get(assertion.tag) || new Set());
      
      if (assertion.kind === 'need') {
        return _(allAssertions)
          .filter({ kind: 'have' })
          .map(have => ({ need: assertion, have }))
          .value();
      } else {
        return _(allAssertions)
          .filter({ kind: 'need' })  
          .map(need => ({ need, have: assertion }))
          .value();
      }
    }
  
    private wire(match: { need: Assertion, have: Assertion }): void {
      const wireId = `${match.have.source}->${match.need.source}`;
      
      // Don't create duplicate wires
      if (this.wires.has(wireId)) return;
      
      const provider = this.gadgets.get(match.have.source);
      const consumer = this.gadgets.get(match.need.source);
      
      if (provider && consumer) {
        // Create the actual wire through event listeners
        provider.addEventListener('propagate', (e: Event) => {
          const data = (e as CustomEvent).detail;
          consumer.receive(data);
        });
        
        this.wires.add(wireId);
        console.log(`Pool wired: ${match.have.source} → ${match.need.source}`);
        this.emit('wired', { from: match.have.source, to: match.need.source });
      }
    }
    
    emit(event: string, data: unknown): void {
      this.dispatchEvent(new CustomEvent(event, { detail: data }));
    }
  }
  
  // Helper to bootstrap gadgets with assertions
  export function createGadget(id: string, pool: Pool, needs?: string[], provides?: string[]): Gadget {
    const gadget = new Gadget(id);
    pool.register(gadget);
    
    // Setup initial protocol to announce needs/provides
    gadget.use(_.cond([
      [_.matches({ type: 'init' }), () => {
        needs?.forEach(tag => {
          gadget.emit('assert', need(tag, id));
        });
        provides?.forEach(tag => {
          gadget.emit('assert', have(tag, id));
        });
      }],
      [_.stubTrue, _.noop]
    ]));
    
    // Initialize
    gadget.receive({ type: 'init' });
    
    return gadget;
  }
// // Pool with lodash operations
// export class Pool extends EventTarget {
//   private assertions = new Map<string, Set<IAssertion>>();

//   receive = _.cond([
//     [isAssertion, (assertion: IAssertion) => {
//       // Group assertions by tag
//       const group = this.assertions.get(assertion.tag) || new Set();
//       group.add(assertion);
//       this.assertions.set(assertion.tag, group);
      
//       // Find matches using lodash
//       const matches = this.findMatches(assertion);
//       _.forEach(matches, match => {
//         this.dispatchEvent(new CustomEvent('match', { detail: match }));
//       });
//     }],
//     [_.stubTrue, _.noop]
//   ]);

//   private findMatches(assertion: IAssertion) {
//     const allAssertions = Array.from(this.assertions.get(assertion.tag) || new Set());
    
//     if (assertion.kind === 'need') {
//       // Find all haves that match this need
//       return _(allAssertions)
//         .filter({ kind: 'have' })
//         .map(have => ({ need: assertion, have }))
//         .value();
//     } else {
//       // Find all needs that match this have
//       return _(allAssertions)
//         .filter({ kind: 'need' })
//         .map(need => ({ need, have: assertion }))
//         .value();
//     }
//   }
// }

// // Gadget with lodash utilities
// export class Gadget extends EventTarget {
//   constructor(
//     public readonly id = _.uniqueId('gadget-'),
//     private protocols: Array<(data: unknown) => void> = []
//   ) {
//     super();
//   }

//   receive(data: unknown): void {
//     _.forEach(this.protocols, protocol => protocol(data));
//   }

//   use(protocol: (data: unknown) => void): this {
//     this.protocols.push(protocol);
//     return this;
//   }

//   emit = _.throttle((event: string, data: unknown) => {
//     this.dispatchEvent(new CustomEvent(event, { detail: data }));
//   }, 16); // Throttled to ~60fps
// }

// Compose protocols with lodash
export const compose = (...protocols: Array<(data: unknown) => void>) => {
  return (data: unknown) => {
    _.forEach(protocols, p => p(data));
  };
};

// Pattern matching with lodash
export const when = (pattern: any, handler: (data: any) => void) => {
  return _.cond([
    [_.matches(pattern), handler],
    [_.stubTrue, _.noop]
  ]);
};

// Builder using lodash
export const G = {
  cell: <T>(merge: (a: T, b: T) => T, initial: T) => 
    // @ts-ignore
    new Gadget().use(cell(merge, initial)),
    
  fn: <I, O>(transform: (i: I) => O) =>
    // @ts-ignore
    new Gadget().use(_.cond([
      [isValue, (data: Value<I>) => {
        const result = transform(data.value);
        if (result != null) {
          console.log('propagate:', result);
        }
      }],
      [_.stubTrue, _.noop]
    ])),
    
  pool: () => new Pool()
};