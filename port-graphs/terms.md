# Propagation Network: Architecture Design

## Core Model

Gadgets are computational units with multiple input queues (ports). Each port receives its own stream of terms. Gadgets interpret terms based on which port received them. The system is built from **small, orthogonal components** that compose together naturally.

## Core Term Library

Our term system provides the fundamental building blocks:

**Atomic Terms:**
- `string`, `number`, `boolean`, `symbol`
- `Nothing` - represents no value
- `Contradiction` - represents logical contradiction

**Compound Terms:**
- `Term[]` - lists (arrays)
- `{ [key: string]: Term }` - dictionaries (objects)

**Special Types:**
- `Opaque<T>` - embed host language data
- `ContradictionTerm` - structured contradiction with context

**Predicates:**
- `stringp`, `numberp`, `booleanp`, `symbolp`
- `listp`, `dictp`, `atomp`, `compoundp`
- `nothingp`, `contradictionp`, `opaquep`

**Set Operations:**
- `setUnionMerge` - combines sets via ACI properties
- `setDifferenceMerge` - removes elements from first set

## Symbol Management

```typescript
class Network {
    private symbols = new Set<string>([
        // Core operations
        'gadget', 'port', 'wire', 'send',
        // Merge strategies  
        'max', 'min', 'union', 'replace', 'setUnion', 'setDifference',
        // Results
        'ok', 'error', 'contradiction',
        // Control
        'merge', 'add-port', 'compute', 'connect', 'connect-and-sync', 'batch'
    ])
    
    private allowDynamicSymbols = false
    
    validateTerm(term: Term): Result {
        const [symbol] = term
        if (!this.symbols.has(symbol)) {
            if (!this.allowDynamicSymbols) {
                return ['error', 'unknown_symbol', symbol]
            }
            this.symbols.add(symbol)
        }
        return ['ok', term]
    }
}
```

## Gadget Architecture

```typescript
class Gadget {
    private ports = new Map<string, Term[]>()   // Port → message queue
    private values = new Map<string, any>()     // Port → current value
    private edges = new Map<string, Set<PortPath>>()  // Port → targets
    private merge: (old: any, new: any) => any = (_, n) => n
    
    constructor(id: GadgetId) {
        // Three standard ports
        this.ports.set('control', [])
        this.ports.set('edges', [])
        this.ports.set('data', [])
    }
    
    receive(portName: string, term: Term): Result {
        if (!this.ports.has(portName)) {
            return ['error', 'unknown_port', portName]
        }
        
        this.ports.get(portName).push(term)
        return this.processPort(portName)
    }
    
    private processPort(portName: string): Result {
        const queue = this.ports.get(portName)
        let lastResult: Result = ['ok', null]
        
        while (queue.length > 0) {
            const term = queue.shift()
            
            switch(portName) {
                case 'control':
                    lastResult = this.interpretControl(term)
                    break
                case 'edges':
                    lastResult = this.interpretEdges(term)
                    break
                default:
                    lastResult = this.interpretData(portName, term)
                    this.compute()  // Check if ready to compute
            }
        }
        return lastResult
    }
    
    private interpretControl(term: Term): Result {
        match(term) {
            case ['add-port', name]:
                this.ports.set(name, [])
                return ['ok', name]
                
            case ['merge', strategy]:
                this.merge = this.lookupMerge(strategy)
                return ['ok', strategy]
        }
    }
    
    private interpretEdges(term: Term): Result {
        match(term) {
            case ['connect', myPort, targetPath]:
                if (!this.edges.has(myPort)) {
                    this.edges.set(myPort, new Set())
                }
                this.edges.get(myPort).add(targetPath)
                return ['ok', 'connected']
        }
    }
    
    private interpretData(portName: string, term: Term): Result {
        const old = this.values.get(portName)
        const merged = this.merge(old, term)
        this.values.set(portName, merged)
        this.propagate(portName, merged)
        return ['ok', merged]
    }
    
    private propagate(portName: string, value: any) {
        const targets = this.edges.get(portName) || new Set()
        targets.forEach(targetPath => {
            const [gadgetId, targetPort] = targetPath.split('.')
            // Send directly to target gadget's port
            this.network.route(gadgetId, targetPort, value)
        })
    }
}
```

## Routing Protocol

```typescript
// Network routes to specific port on gadget
['route', gadgetId: string, portName: string, term: Term]

// Examples:
['route', 'adder', 'in0', ['value', 5]]
['route', 'adder', 'control', ['merge', 'max']]
['route', 'adder', 'edges', ['connect', 'out', 'display.in']]
```

## Bootstrap Sequence

```typescript
// Create gadgets
['gadget', 'sensor']
['gadget', 'processor']

// Configure via control port
['route', 'sensor', 'control', ['add-port', 'temp']]
['route', 'processor', 'control', ['add-port', 'in']]
['route', 'processor', 'control', ['add-port', 'out']]
['route', 'processor', 'control', ['merge', 'max']]

// Wire topology via edges port
['route', 'sensor', 'edges', ['connect', 'temp', 'processor.in']]
['route', 'processor', 'edges', ['connect', 'out', 'display.in']]

// Send data to data ports
['route', 'sensor', 'temp', ['ok', 25.5]]
```

## Port Types

- **Control** - Receives behavioral configuration terms
- **Edges** - Receives topology changes
- **Data ports** - User-defined, receive domain values

## Error Handling

Errors flow as data:

```typescript
['route', 'processor', 'in', ['error', 'sensor_failure', 'timeout']]
['route', 'processor', 'in', ['ok', 25.5]]

// Processor's merge strategy determines outcome
mergePessimistic: (old, new) => new[0] === 'error' ? new : old
mergeOptimistic: (old, new) => new[0] === 'ok' ? new : old
```

## Truth Maintenance System (TMS)

The TMS is built **in user space** from **small, orthogonal components** - just three cells with simple set operations. No special system-level support needed:

```typescript
// Three simple cells with set merge functions
const allPremises = new Cell('all-premises', network, {}, setUnionMerge)
const nogoodPremises = new Cell('nogood-premises', network, {}, setUnionMerge)  
const believedPremises = new Cell('believed-premises', network, {}, setDifferenceMerge)

// Simple connections maintain: believed = all - nogoods
connect(allPremises, 'value-out', believedPremises, 'all')
connect(nogoodPremises, 'value-out', believedPremises, 'subtract')
```

**Set Operations as Merge Functions:**
- `setUnionMerge` - combines sets naturally via ACI properties
- `setDifferenceMerge` - removes elements from first set
- Both handle `Nothing` gracefully for initialization

**Contradiction Handling:**
- Enhanced merge functions return `ContradictionTerm` on errors
- Contradictions propagate back to TMS as data
- No manual backtracking - the network self-corrects

## Small Orthogonal Components Philosophy

**What We Build:**
- **Set merge functions** (union, difference) - pure user-space functions
- **Connect the cells** for TMS logic - using existing connection primitives
- **Enhance existing merge functions** for contradiction detection - no system changes
- **That's it!** No new gadget types, no system-level TMS support needed

**What We Already Have:**
- **Cell class** - just use it with set merge functions
- **Port system** - just need to connect them
- **Merge functions** - just need to enhance them
- **Propagation** - already works

**The Beauty:**
- **TMS is just three cells** connected in a specific way
- **Set operations are just merge functions** - pure user-space logic
- **Contradiction handling is just enhanced merge functions** - no system changes
- **Everything composes naturally** with our existing system
- **Built entirely in user space** - demonstrates the power of our composition model

## Design Rationale

**Ports as queues** - Each port has independent message stream, no multiplexing needed.

**Three port types** - Control (behavior), edges (topology), data (computation).

**Distributed edges** - Each gadget stores only its outgoing connections.

**Fire-and-forget** - No acknowledgments, ACI merge ensures convergence.

**Gadget interprets** - Ports are dumb buffers, gadgets assign meaning.

**Small components** - Build complex systems from simple, composable pieces.

**Orthogonal design** - Each component has a single, clear responsibility.

**User-space composition** - Complex systems like TMS emerge from simple primitives, no special system support needed.

The network is emergent from local gadget connections. No central routing table required.