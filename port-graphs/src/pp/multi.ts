/**
 * Core Gadget Model - TypeScript Implementation
 * 
 * Based on the pattern: consider → act
 * Where act is a multimethod dispatching on decision values
 */

import _ from "lodash";


// Example pure operations for consider phase
export const defaultConsiderOps = {
  equals: (a: any, b: any) => a === b,
  compare: (a: any, b: any) => a > b ? 1 : a < b ? -1 : 0,
  isEmpty: (obj: any) => !obj || (typeof obj === 'object' && Object.keys(obj).length === 0),
  hasTag: (msg: any, tag: string) => msg?.tag === tag,
  exists: (value: any) => value !== undefined && value !== null,
  isType: (value: any, type: string) => typeof value === type
}

// Example effectful operations for act phase
export const defaultActOps = {
  setState: (gadgetId: string, newState: any) => {
    console.log(`[${gadgetId}] state →`, newState)
  },
  emit: (channel: string, value: any) => {
    console.log(`[emit:${channel}]`, value)
  },
  connect: (from: string, to: string) => {
    console.log(`[connect] ${from} → ${to}`)
  },
  log: (message: string, ...args: any[]) => {
    console.log(message, ...args)
  }
}

type ConsiderOps = typeof defaultConsiderOps
type ActOps = typeof defaultActOps

type DispatchFn<T extends any[] & {length: L}, L extends number, K extends string> = (...args: T) => K;
type DispatchMap<
    T extends any[] & {length: L},
    L extends number = T['length'],
    K extends string = string,
    V extends any = any,
    Mode extends 'strict' | 'partial' = 'strict',
    > =
    Mode extends 'strict'
        ? Record<K, (...args: T) => V> & {default: (...args: T) => V}
        : Partial<Record<K, (...args: T) => V>> & {default: (...args: T) => V | undefined};

export type MultiMethod<T extends any[] & {length: L}, L extends number, K extends string, V extends any> = {
    dispatch: DispatchFn<T, L, K>,
    action: DispatchMap<T,L,K,V>,
    defMethod: (key: K, fn: (...args: T) => V) => void,
    defMethods: (methods: Record<K, (...args: T) => V>) => void,
    (...args: T): V
}

export type GadgetMultiMethod<Curr, Incoming, Action extends string> = MultiMethod<[Curr, Incoming], 2, Action, void>;

export function defMulti<
    T extends any[] & {length: L},
    L extends number,
    K extends string,
    V extends any,
>(
    dispatch: DispatchFn<T, L, K>,
): MultiMethod<T, L, K, V> {
    const action: DispatchMap<T,L,K,V> = {default: _.constant(undefined)} as DispatchMap<T,L,K,V>;
    const defMethod = (key: K, fn: (...args: T) => V) => {
        action[key] = fn as DispatchMap<T,L,K,V>[K];
    };
    const defMethods = (methods: Record<K, (...args: T) => V>) => {
        for (const [key, fn] of Object.entries(methods)) {
            action[key] = fn;
        }
    };

    function call(...args: T): V {
        const key = dispatch(...args);
        const fn = action[key] || action['default'];
        if (!fn) {
            throw new Error(`No method or default for key: ${key}`);
        }
        return fn(...args);
    };

    call.dispatch = dispatch;
    call.action = action;
    call.defMethod = defMethod;
    call.defMethods = defMethods;

    return call
}

const foo = defMulti((number: number) => number > 0 ? 'positive' : 'negative');
foo.defMethods({
    'positive': (number: number) => number * 2,
    'negative': (number: number) => number * -1,
})

const byClass = defMulti((c: any) => c.name.toString())

byClass.defMethods({
    'String': (c) => console.log('isa string'),
    'default': (c) => console.log('not string'),
})

byClass(String)
byClass(Object)
byClass(Error)

console.log('foo(1) = ', foo(1));
console.log('foo(-1) = ', foo(-1));

const sum = defMulti((current, number) => {
    if (current === undefined && _.isNumber(number)) {
        return 'init';
    }
    if (current && _.isNumber(number)) {
        return 'number';
    }
    return 'default';
});

sum.defMethods({
    'init': (current, number) => number,
    'number': (current, number) => current + number,
    'default': (current, number) => current,
})

const arr = [1, 2, 3, 4, 'asdf', {hello: 'world'}, 5];

//@ts-ignore
console.log('sum(arr) = ', arr.reduce(sum));

interface Gadget {
    id: string,
    chaperone?: Gadget,
    behavior: any,
    state: any
}

export type GadgetPhase = 'consider' | 'act'

let CURRENT_GADGET: Gadget | null = null;

function currentGadget() {
    return CURRENT_GADGET
}
function withGadget(gadget: Gadget, body: () => void) {
    const old = CURRENT_GADGET;
    CURRENT_GADGET = gadget;
    body();
    CURRENT_GADGET = old;
}

const gadgetDispatchFn = () => currentGadget()
    ? 'null' 
    : currentGadget()!.chaperone
    ? 'owned'
    : 'notOwned';

const setState = defMulti((state, newState) => gadgetDispatchFn());

setState.defMethods({
    'null': (state, newState) => { throw new Error('null???')},
    'notOwned': (state, newState) => { state = newState},
    'owned': (state, newState) => {
        withGadget(currentGadget()?.chaperone!, () => {
            setState(state, newState);
        });
    }
});


// Example Gadgets using multimethod

//1. Counter - discriminates on command types
// const counter = defMulti((
//     state: { count: number, id: string }, 
//     input: { type: string, amount?: number }, 
//     ops: ConsiderOps & ActOps) => {
//   if (ops.isEmpty(state)) return 'init'
//   if (ops.equals(input.type, 'increment')) return 'inc'
//   if (ops.equals(input.type, 'decrement')) return 'dec'
//   if (ops.equals(input.type, 'reset')) return 'reset'
//   return 'noop'  // Explicit return instead of undefined
// });

// counter.defMethods(
//   {
//     'init': (_state, input, ops: ActOps) => {
//       const initial = { count: 0, id: input.id || 'counter' }
//       ops.setState(initial.id, initial)
//       ops.log('Counter initialized:', initial)
//       return initial
//     },
//     'inc': (state, input, ops) => {
//       if (!state) throw new Error('Counter not initialized')
//       const amount = input.amount || 1
//       const newState = { ...state, count: state.count + amount }
//       ops.setState(state.id, newState)
//       ops.emit('count-changed', newState.count)
//       return newState
//     },
//     'dec': (state, input, ops) => {
//       if (!state) throw new Error('Counter not initialized')
//       const amount = input.amount || 1
//       const newState = { ...state, count: state.count - amount }
//       ops.setState(state.id, newState)
//       ops.emit('count-changed', newState.count)
//       return newState
//     },
//     'reset': (state, _input, ops) => {
//       if (!state) throw new Error('Counter not initialized')
//       const newState = { ...state, count: 0 }
//       ops.setState(state.id, newState)
//       ops.emit('count-reset', state.id)
//       return newState
//     },
//     'noop': (state) => state || { count: 0, id: 'counter' }
//   }
// )

// // 2. MaxCell - tracks maximum value
// export const maxCell = multimethod<
//   { max: number; id: string },
//   { value: number; id?: string }
// >(
//   (state, input, ops) => {
//     if (ops.isEmpty(state)) return 'init'
//     const cmp = ops.compare(input.value, state.max)
//     if (cmp > 0) return 'increase'
//     if (cmp < 0) return 'decrease'
//     return 'same'
//   },
//   {
//     'init': (_state, input, ops) => {
//       const initial = { max: input.value, id: input.id || 'maxCell' }
//       ops.setState(initial.id, initial)
//       return initial
//     },
//     'increase': (state, input, ops) => {
//       if (!state) throw new Error('MaxCell not initialized')
//       const newState = { ...state, max: input.value }
//       ops.setState(state.id, newState)
//       ops.emit('max-changed', { old: state.max, new: input.value })
//       ops.log(`Max increased: ${state.max} → ${input.value}`)
//       return newState
//     },
//     'decrease': (state) => {
//       if (!state) throw new Error('MaxCell not initialized')
//       return state
//     },
//     'same': (state) => {
//       if (!state) throw new Error('MaxCell not initialized')
//       return state
//     },
//     'noop': (state) => {
//       if (!state) throw new Error('MaxCell not initialized')
//       return state
//     }
//   }
// )

// // 3. Pool - accumulates assertions and creates connections
// type Assertion = { 
//   type: 'needs' | 'provides'
//   tag: string
//   gadgetId: string 
// }

// type PoolState = {
//   id: string
//   needs: Map<string, Set<string>>    // tag → gadget IDs that need it
//   provides: Map<string, Set<string>>  // tag → gadget IDs that provide it
// }

// export const pool = multimethod<PoolState, Assertion>(
//   (state, input, ops) => {
//     if (ops.isEmpty(state)) return 'init'
//     return input.type  // 'needs' or 'provides'
//   },
//   {
//     'init': (_state, input, ops) => {
//       const initial: PoolState = {
//         id: 'pool',
//         needs: new Map(),
//         provides: new Map()
//       }
//       ops.setState(initial.id, initial)
      
//       // Process the initial assertion
//       if (input.type === 'needs') {
//         initial.needs.set(input.tag, new Set([input.gadgetId]))
//       } else if (input.type === 'provides') {
//         initial.provides.set(input.tag, new Set([input.gadgetId]))
//       }
      
//       return initial
//     },
//     'needs': (state, input, ops) => {
//       if (!state) throw new Error('Pool not initialized')
      
//       // Add to needs map
//       if (!state.needs.has(input.tag)) {
//         state.needs.set(input.tag, new Set())
//       }
//       state.needs.get(input.tag)!.add(input.gadgetId)
      
//       // Check for matching providers
//       const providers = state.provides.get(input.tag)
//       if (providers) {
//         for (const providerId of providers) {
//           ops.connect(providerId, input.gadgetId)
//           ops.emit('connection-created', { 
//             from: providerId, 
//             to: input.gadgetId, 
//             tag: input.tag 
//           })
//         }
//       }
      
//       ops.setState(state.id, state)
//       return state
//     },
//     'provides': (state, input, ops) => {
//       if (!state) throw new Error('Pool not initialized')
      
//       // Add to provides map
//       if (!state.provides.has(input.tag)) {
//         state.provides.set(input.tag, new Set())
//       }
//       state.provides.get(input.tag)!.add(input.gadgetId)
      
//       // Check for matching needs
//       const needers = state.needs.get(input.tag)
//       if (needers) {
//         for (const neederId of needers) {
//           ops.connect(input.gadgetId, neederId)
//           ops.emit('connection-created', { 
//             from: input.gadgetId, 
//             to: neederId, 
//             tag: input.tag 
//           })
//         }
//       }
      
//       ops.setState(state.id, state)
//       return state
//     },
//     'noop': (state) => {
//       if (!state) throw new Error('Pool not initialized')
//       return state
//     }
//   }
// )

// // 4. Chaperone - wraps operations to observe gadget behavior
// export function createChaperone<S, I>(
//   target: (state: S | undefined, input: I, considerOps: ConsiderOps, actOps: ActOps) => S,
//   observer: (phase: 'consider' | 'act', decision: string | undefined, state: S | undefined, input: I) => void
// ): (state: S | undefined, input: I, considerOps: ConsiderOps, actOps: ActOps) => S {
//   return (state, input, considerOps = defaultConsiderOps, actOps = defaultActOps) => {
//     // Wrap considerOps to observe discriminations
//     const wrappedConsiderOps: ConsiderOps = {
//       ...considerOps,
//       // Each op calls through but we can observe
//       equals: (a, b) => {
//         const result = considerOps.equals(a, b)
//         return result
//       },
//       compare: (a, b) => considerOps.compare(a, b),
//       isEmpty: (obj) => considerOps.isEmpty(obj),
//       hasTag: (msg, tag) => considerOps.hasTag(msg, tag),
//       exists: (value) => considerOps.exists(value),
//       isType: (value, type) => considerOps.isType(value, type)
//     }
    
//     // Wrap actOps to observe effects
//     const wrappedActOps: ActOps = {
//       ...actOps,
//       setState: (gadgetId, newState) => {
//         observer('act', 'setState', state, input)
//         actOps.setState(gadgetId, newState)
//       },
//       emit: (channel, value) => {
//         observer('act', 'emit', state, input)
//         actOps.emit(channel, value)
//       },
//       connect: (from, to) => {
//         observer('act', 'connect', state, input)
//         actOps.connect(from, to)
//       },
//       log: (message, ...args) => {
//         actOps.log(message, ...args)
//       }
//     }
    
//     // Execute the target with wrapped operations
//     return target(state, input, wrappedConsiderOps, wrappedActOps)
//   }
// }

// // // Runtime for executing gadgets
// // export class GadgetRuntime {
// //   // Execute one step of a gadget
// //   step<S, I, D extends string | number | symbol>(
// //     gadget: Gadget<S, I, D>,
// //     state: S,
// //     input: I
// //   ): S {
// //     const decision = gadget.consider(state, input, this.considerOps)
// //     const reducer = gadget.act.get(decision)
    
// //     if (!reducer) {
// //       throw new Error(`No action defined for decision: ${String(decision)}`)
// //     }
    
// //     return reducer(state, input, this.actOps)
// //   }
  
// //   // Reduce a sequence of inputs through a gadget
// //   reduce<S, I, D extends string | number | symbol>(
// //     gadget: Gadget<S, I, D>,
// //     inputs: I[]
// //   ): S {
// //     return inputs.reduce(
// //       (state, input) => this.step(gadget, state, input),
// //       gadget.initial
// //     )
// //   }
// // }

// // // Example Gadgets

// // // 1. Cell - accumulates maximum value
// // export const maxCell: Gadget<number, number, 'increase' | 'decrease' | 'same'> = {
// //   initial: -Infinity,
  
// //   consider: (state, input, ops) => {
// //     const cmp = ops.compare(input, state)
// //     if (cmp > 0) return 'increase'
// //     if (cmp < 0) return 'decrease'
// //     return 'same'
// //   },
  
// //   act: new Map([
// //     ['increase', (state: any, input: any, ops: { propagate: (arg0: string, arg1: { old: any; new: any; }) => void; }) => {
// //       ops.propagate('value-changed', { old: state, new: input })
// //       return input
// //     }],
// //     ['decrease', (state: any, input: any) => state],
// //     ['same', (state: any, input: any) => state]
// //   ])
// // }

// // // 2. Threshold Monitor - stateless function gadget
// // export const thresholdMonitor: Gadget<null, number, 'over' | 'under'> = {
// //   initial: null,
  
// //   consider: (state, input, ops) => {
// //     return input > 100 ? 'over' : 'under'
// //   },
  
// //   act: new Map([
// //     ['over', (state: any, input: any, ops: { propagate: (arg0: string, arg1: { type: string; value: any; }) => void; }) => {
// //       ops.propagate('alarm', { type: 'threshold-exceeded', value: input })
// //       return null
// //     }],
// //     ['under', (state: any, input: any) => null]
// //   ])
// // }

// // // 3. Pool - accumulates assertions and creates connections
// // type Assertion = { type: 'needs' | 'provides', tag: string, gadget: string }
// // type PoolState = {
// //   needs: Map<string, Assertion>
// //   provides: Map<string, Assertion>
// // }

// // export const pool: Gadget<PoolState, Assertion, 'needs' | 'provides'> = {
// //   initial: { needs: new Map(), provides: new Map() },
  
// //   consider: (state, input) => input.type,
  
// //   act: new Map([
// //     ['needs', (state: { needs: { set: (arg0: any, arg1: any) => void; }; provides: { get: (arg0: any) => any; }; }, input: { tag: any; gadget: any; }, ops: { connect: (arg0: any, arg1: any) => void; }) => {
// //       state.needs.set(input.tag, input)
      
// //       // Check for matching provider
// //       const provider = state.provides.get(input.tag)
// //       if (provider) {
// //         ops.connect(provider.gadget, input.gadget)
// //       }
      
// //       return state
// //     }],
    
// //     ['provides', (state: { provides: { set: (arg0: any, arg1: any) => void; }; needs: { get: (arg0: any) => any; }; }, input: { tag: any; gadget: any; }, ops: { connect: (arg0: any, arg1: any) => void; }) => {
// //       state.provides.set(input.tag, input)
      
// //       // Check for matching needs
// //       const needer = state.needs.get(input.tag)
// //       if (needer) {
// //         ops.connect(input.gadget, needer.gadget)
// //       }
      
// //       return state
// //     }]
// //   ])
// // }

// // // 4. Chaperone - wraps another gadget to observe its behavior
// // export function createChaperone<S, I, D extends string | number | symbol>(
// //   target: Gadget<S, I, D>,
// //   observer: (decision: D, state: S, input: I) => void
// // ): Gadget<S, I, D> {
// //   return {
// //     initial: target.initial,
    
// //     consider: (state, input, ops) => {
// //       const decision = target.consider(state, input, ops)
// //       observer(decision, state, input)
// //       return decision
// //     },
    
// //     act: new Map(
// //       Array.from(target.act.entries()).map(([decision, reducer]) => [
// //         decision,
// //         (state: S, input: I, ops: ActOps) => {
// //           // Could also observe the action phase
// //           return reducer(state, input, ops)
// //         }
// //       ])
// //     )
// //   }
// // }

// //   const runtime = new GadgetRuntime()
  
// //   console.log('=== Max Cell Example ===')
// //   const cellState = runtime.reduce(maxCell, [1, 5, 3, 7, 2])
// //   console.log('Final state:', cellState) // 7
  
// //   console.log('\n=== Pool Example ===')
// //   const poolState = runtime.reduce(pool, [
// //     { type: 'needs', tag: 'temperature', gadget: 'display' },
// //     { type: 'provides', tag: 'temperature', gadget: 'sensor' }
// //   ])
// //   console.log('Pool state:', poolState)
  
// //   console.log('\n=== Chaperone Example ===')
// //   const observed = createChaperone(maxCell, (decision, state, input) => {
// //     console.log(`[OBSERVE] Decision: ${decision}, State: ${state}, Input: ${input}`)
// //   })
// //   runtime.reduce(observed, [1, 2, 1, 3])


// // === Test Examples ===

// console.log('\n=== Counter Example ===')
// let counterState: { count: number; id: string } | undefined = undefined

// // Initialize
// counterState = counter(counterState, { type: 'init', id: 'myCounter' })
// console.log('After init:', counterState)

// // Increment
// counterState = counter(counterState, { type: 'increment' })
// console.log('After increment:', counterState)

// // Increment by 5
// counterState = counter(counterState, { type: 'increment', amount: 5 })
// console.log('After increment by 5:', counterState)

// // Decrement
// counterState = counter(counterState, { type: 'decrement' })
// console.log('After decrement:', counterState)

// // Reset
// counterState = counter(counterState, { type: 'reset' })
// console.log('After reset:', counterState)

// console.log('\n=== MaxCell Example ===')
// let maxState: { max: number; id: string } | undefined = undefined

// const values = [1, 5, 3, 7, 2, 9, 4]
// for (const value of values) {
//   maxState = maxCell(maxState, { value })
//   console.log(`Input: ${value}, Max: ${maxState.max}`)
// }

// console.log('\n=== Pool Example ===')
// let poolState: PoolState | undefined = undefined

// // Register a sensor that provides temperature
// poolState = pool(poolState, { 
//   type: 'provides', 
//   tag: 'temperature', 
//   gadgetId: 'sensor1' 
// })

// // Register a display that needs temperature
// poolState = pool(poolState, { 
//   type: 'needs', 
//   tag: 'temperature', 
//   gadgetId: 'display1' 
// })
// console.log('Pool state after connections:', {
//   needs: Array.from(poolState.needs.entries()),
//   provides: Array.from(poolState.provides.entries())
// })

// // Register another display that needs temperature
// poolState = pool(poolState, { 
//   type: 'needs', 
//   tag: 'temperature', 
//   gadgetId: 'display2' 
// })

// console.log('\n=== Chaperone Example ===')
// const observedCounter = createChaperone(
//   counter,
//   (phase, decision, state, input) => {
//     console.log(`[OBSERVE] Phase: ${phase}, Decision: ${decision}, State:`, state, 'Input:', input)
//   }
// )

// let observedState: { count: number; id: string } | undefined = undefined
// observedState = observedCounter(observedState, { type: 'init', id: 'observed' }, defaultConsiderOps, defaultActOps)
// observedState = observedCounter(observedState, { type: 'increment' }, defaultConsiderOps, defaultActOps)
// observedState = observedCounter(observedState, { type: 'increment', amount: 3 }, defaultConsiderOps, defaultActOps)

// console.log('\n=== Transducer Examples ===')
// const anArray = [1,2,3,4]
// const sum = (acc: number, x: number) => acc + x
// const filterOdd = filter((x: number) => x % 2 === 1)

// // Just filter
// let result = transduce(filterOdd, sum, anArray, 0)
// console.log('Filter odd:', result)  // 1 + 3 = 4

// // Compose filter and map
// const composed = compose(
//   filter((x: number) => x % 2 === 1),
//   map((x: number) => x * 2)
// )
// result = transduce(composed, sum, anArray, 0)
// console.log('Filter odd then double:', result)  // (1*2) + (3*2) = 8