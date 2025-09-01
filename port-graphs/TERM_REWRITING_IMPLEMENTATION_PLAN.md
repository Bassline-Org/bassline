# Term Rewriting with Graph Rewrites: Implementation Plan

## Overview

This document outlines the implementation plan for adding **term rewriting with graph rewrites** to our propagation network system. Instead of building a separate rewrite engine, we'll leverage our existing constraint solving capabilities by implementing a **Truth Maintenance System (TMS)** that handles rewrite rules as premises and automatically refines them when contradictions are found.

## Key Insight: TMS-Based Approach

Rather than implementing complex graph rewriting machinery, we'll use our existing propagation network with a TMS layer:
- **Rewrite rules become premises** in the TMS
- **Contradictions automatically propagate** back to refine the premise set
- **No manual backtracking** - pure propagation with contradiction feedback loops
- **Leverages our existing constraint solving** capabilities

## Core Concepts

### 1. TMS Architecture
The **Truth Maintenance System** provides the foundation for rewrite rule management:
- **Three Cells**: `all-premises`, `nogoods`, `believed-premises`
- **Automatic Refinement**: `believed = all - nogoods`
- **Contradiction Propagation**: Contradictions automatically refine the believed set
- **No Manual Backtracking**: Pure propagation with feedback loops

### 2. Contradiction Handling in Merge Functions
Merge functions can detect and propagate contradictions:
- **Try-Catch Pattern**: Return contradiction terms when errors occur
- **Generic Contradiction Terms**: `['contradiction', error, oldValue, newValue]`
- **Composition with Premises**: TMS composes contradictions with premise sets
- **Automatic Propagation**: Contradictions flow back to refine premise sets

### 2. Rewrite Rules as Terms
Rewrite rules are represented as graphs themselves:
```typescript
type RewriteRule = {
  leftPattern: GraphTerm,      // What to match
  rightPattern: GraphTerm,     // What to replace with
  arrowNode: ArrowNodeTerm,    // How to transform
  conditions: Term[],          // When to apply
  strategy?: Term              // How to apply
}

// Variables are tagged literal types (like Opaque)
// Based on Definition 1: ∇A (attributes), XA (attribute variables), ∇V (values), XV (value variables)
type AttributeVariable = ['attribute-variable', string, string?]  // [tag, name, defaultAttribute?]
type ValueVariable = ['value-variable', string, unknown?]        // [tag, name, defaultValue?]
type GraphVariable = ['graph-variable', string, InterfaceSpec]   // [tag, name, interfaceSpec]

// Interface specification for graph variables (from Definition 7)
type InterfaceSpec = {
  interface: string[],          // Required free ports (from Interface(X))
  constraints: Term[]           // Additional constraints
}

// Records as sets of attribute-value pairs (from Definition 2)
type Record = { [key: string]: Term }  // Must include 'Name' attribute
```

### 3. Pattern Matching
- **Attribute Matching**: Exact match on attributes (name, type, value, etc.)
- **Variable Binding**: Capture values for use in the right-hand side
- **Graph Variables**: Match subgraphs by interface compatibility
- **Condition Checking**: Verify that conditions are satisfied

### 4. Graph Variables and Interface Matching
- **Interface Specification**: Define required free ports and constraints
- **Ladder Semantics**: Replace graph variables with matching subgraphs
- **Interface Compatibility**: Ensure replacement maintains port compatibility
- **Hierarchical Structure**: Support nested graphs through ladder relationships

## Implementation Phases

### Phase 1: Core TMS Infrastructure

#### 1.1 Contradiction Handling in Merge Functions
```typescript
// Generic contradiction terms for merge function errors
export type ContradictionTerm = ['contradiction', string, Term, Term] // [tag, error, oldValue, newValue]

// Enhanced merge function pattern with contradiction detection
const enhancedMerge = (current: Term, incoming: Term): Term => {
  try {
    // Attempt the merge
    return originalMerge(current, incoming)
  } catch (error) {
    // Return contradiction term instead of throwing
    return ['contradiction', error.message, current, incoming]
  }
}

// Example: Enhanced ordinal merge with contradiction detection
const enhancedOrdinalMerge = (current: Term, incoming: Term): Term => {
  try {
    if (current === Nothing) {
      if (ordinalp(incoming)) {
        return incoming
      } else {
        throw new Error(`OrdinalMerge: incoming is not an ordinal tuple: ${incoming}`)
      }
    }
    if (ordinalp(current) && ordinalp(incoming)) {
      if (extractHeight(incoming) > extractHeight(current)) {
        return incoming
      } else {
        return current
      }
    }
    throw new Error(`OrdinalMerge: current is not an ordinal tuple: ${current} or incoming is not an ordinal tuple: ${incoming}`)
  } catch (error) {
    return ['contradiction', error.message, current, incoming]
  }
}
```

#### 1.2 TMS Cell System
```typescript
// Three-cell TMS architecture
const createTMS = (network: Network) => {
  const allPremises = new Cell('all-premises', network, {}, setUnionMerge)
  const nogoodPremises = new Cell('nogood-premises', network, {}, setUnionMerge)
  const believedPremises = new Cell('believed-premises', network, {}, setDifferenceMerge)
  
  // Connect the cells for automatic refinement
  connect(allPremises, 'value-out', believedPremises, 'all-premises')
  connect(nogoodPremises, 'value-out', believedPremises, 'nogood-premises')
  
  return { allPremises, nogoodPremises, believedPremises }
}

// Set merge functions
const setUnionMerge = (current: Set<Term>, incoming: Set<Term>): Set<Term> => {
  if (current === Nothing) return incoming
  return new Set([...current, ...incoming])
}

const setDifferenceMerge = (current: Set<Term>, incoming: Set<Term>): Set<Term> => {
  if (current === Nothing) return incoming
  return new Set([...current].filter(x => !incoming.has(x)))
}
```

#### 1.3 Rewrite Rules as TMS Premises
```typescript
// Rewrite rules are just premises in the TMS
const createRewritePremise = (name: string, pattern: Term, replacement: Term, conditions?: Term[]): Term => [
  'rewrite-premise',
  name,
  {
    pattern,
    replacement,
    conditions: conditions || []
  }
]

// Example: Simplify redundant constraints
const simplifyRule = createRewritePremise(
  'simplify-constraints',
  ['graph', ['gadget', 'cell', '?a'], ['gadget', 'cell', '?b']],
  ['graph', ['gadget', 'cell', '?result']],
  [['cells-equal', '?a', '?b']]
)

// Add to TMS
tms.allPremises.receive('value-in', simplifyRule)

// If contradiction found, automatically propagates to nogoods
// Believed set automatically refines
```

#### 1.2 Rewrite Rule Representation
```typescript
// Rewrite rules are just terms - no special syntax needed
const exampleRule = [
  'rewrite-rule',
  'simplify-constraint',
  {
    leftPattern: ['graph', ['cell', 'a'], ['cell', 'b'], ['adder', 'sum']],
    rightPattern: ['graph', ['cell', 'result']],
    arrowNode: ['arrow', 'bridge', 'black-hole', 'wire'],
    conditions: ['constraint-satisfied']
  }
]
```

#### 1.4 Contradiction Propagation and TMS Integration
```typescript
// Contradictions automatically propagate back to TMS
class ContradictionPropagator extends Gadget {
  constructor(name: string, network: Network, tms: TMS) {
    super(name, network, {
      inputs: ['value', 'premise'],
      outputs: ['contradiction'],
      fn: this.handleContradiction.bind(this)
    })
  }
  
  handleContradiction(inputs: TermMap): Term {
    const value = inputs.value
    const premise = inputs.premise
    
    // If value is a contradiction term, compose with premise
    if (contradictionp(value)) {
      const contradictionPremise = [
        'contradiction-premise',
        premise,
        value
      ]
      
      // Propagate to nogoods - this automatically refines believed set
      this.network.getGadget('nogood-premises').receive('value-in', contradictionPremise)
      
      return contradictionPremise
    }
    
    return value
  }
}

// Connect contradiction detection to TMS
const setupContradictionPropagation = (network: Network, tms: TMS) => {
  // Connect all cells to contradiction propagators
  network.gadgets.forEach(gadget => {
    if (gadget instanceof Cell) {
      const propagator = new ContradictionPropagator(
        `${gadget.id}-contradiction-propagator`,
        network,
        tms
      )
      connect(gadget, 'value-out', propagator, 'value')
      // Connect premise tracking
    }
  })
}
```

### Phase 2: Rewrite Execution

#### 2.1 Rewrite Step Execution
```typescript
class RewriteExecutor {
  executeRewrite(rule: RewriteRule, target: GraphTerm): GraphTerm {
    // 1. Find matches (satisfying Definition 5 constraints)
    // 2. Check conditions
    // 3. Apply transformation using SPO semantics
    // 4. Rewire connections according to arrow node
    // 5. Return new graph
  }
  
  private applyTransformation(match: Match, rule: RewriteRule): GraphTerm {
    // Replace matched subgraph with right-hand side
    // Use pushout construction (Property 4)
  }
  
  private rewireConnections(match: Match, rule: RewriteRule): void {
    // Handle bridge, black-hole, and wire ports
    // Bridge: preserve connections, black-hole: delete, wire: rewire
  }
  
  // SPO semantics implementation (from Property 4)
  private computePushout(rule: RewriteRule, match: Match): GraphTerm {
    // Gluing object = ports connected to bridge ports
    // Pushout object = G where m(L) replaced by m(R)
    // External edges redirected according to arrow node
  }
}
```

#### 2.2 Port Type Handling
```typescript
enum PortType {
  BRIDGE = 'bridge',      // Survives rewrite
  BLACK_HOLE = 'black-hole', // Gets deleted
  WIRE = 'wire'           // Gets rewired
}

class PortRewirer {
  rewirePorts(arrowNode: ArrowNodeTerm, match: Match): void {
    // Implement the three port types according to AHP paper:
    // Bridge: Must connect to both L and R (one edge to L, one or more to R)
    // Black-hole: Only connects to L (at least one edge)
    // Wire: Exactly two edges to L, no edges to R
  }
  
  // Validate arrow node port connections (from paper rules)
  validateArrowNodeConnections(arrowNode: ArrowNodeTerm, leftPattern: GraphTerm, rightPattern: GraphTerm): boolean {
    // Ensure each port type follows the connection rules
    // Bridge ports must connect L and R
    // Black-hole ports must only connect to L
    // Wire ports must connect exactly two L ports, no R connections
  }
}
```

### Phase 3: Integration with Existing System

#### 3.1 Term System Extensions
```typescript
// Add new term types for rewrite rules
export type RewriteRuleTerm = ['rewrite-rule', string, RewriteRuleAttributes]
export type ArrowNodeTerm = ['arrow', PortType[], PortMapping[]]
export type PatternTerm = ['pattern', GraphTerm, VariableBindings]

// Extend existing predicates
export const rewriteRulep: Predicate = term => 
  Array.isArray(term) && term[0] === 'rewrite-rule'
export const arrowNodep: Predicate = term => 
  Array.isArray(term) && term[0] === 'arrow'
```

#### 3.2 Network Integration
```typescript
class Network {
  // Add rewrite rule management
  addRewriteRule(rule: RewriteRuleTerm): void
  findApplicableRules(graph: GraphTerm): RewriteRuleTerm[]
  executeRewriteStep(rule: RewriteRuleTerm): boolean
  
  // Strategy control
  setRewriteStrategy(strategy: Term): void
  getRewriteStrategy(): Term
}
```

#### 3.3 Gadget System Extensions
```typescript
// Make gadgets aware of rewrite rules
class Gadget {
  // Add rewrite rule awareness
  canBeRewritten(): boolean
  getRewritePatterns(): PatternTerm[]
  
  // Support for dynamic topology changes
  onRewrite(rule: RewriteRuleTerm): void
}
```

### Phase 4: Advanced Features

#### 4.1 Strategic Rewriting
```typescript
// Strategy language for controlling rewrite application
type Strategy = 
  | ['once', RewriteRuleTerm]
  | ['repeat', Strategy]
  | ['choice', Strategy[]]
  | ['sequence', Strategy[]]
  | ['if', Term, Strategy, Strategy?]
  | ['while', Term, Strategy]

class StrategyEngine {
  executeStrategy(strategy: Strategy, network: Network): void {
    // Execute strategy according to AHP strategic rewriting
  }
}
```

#### 4.2 Hierarchical Rewriting
```typescript
// Support for nested graphs and hierarchical rewriting
class HierarchicalNetwork extends Network {
  // Support for graphs within graphs
  addLadderGraph(node: string, graph: GraphTerm): void
  getLadderGraph(node: string): GraphTerm | null
  
  // Hierarchical pattern matching
  findHierarchicalMatches(pattern: HierarchicalPattern): Match[]
}
```

#### 4.3 Flattening and Optimization
```typescript
// Flatten hierarchical graphs for optimization
class GraphFlattener {
  flatten(graph: HierarchicalGraphTerm): GraphTerm {
    // Recursively replace hierarchical nodes with their contents
    // Maintain port interface compatibility
  }
  
  optimize(graph: GraphTerm): GraphTerm {
    // Apply rewrite rules for optimization
    // Merge equivalent nodes
    // Simplify connections
  }
}
```

## What Needs to Change

### 1. Core System
- **Terms**: Add new term types for rewrite rules and patterns
- **Network**: Add rewrite rule management and execution
- **Gadgets**: Make them rewrite-aware and topology-changeable

### 2. Critical Constraints from Paper
- **Name attribute requirement**: All records must have 'Name' attribute
- **Interface constraint**: Same name implies same interface
- **No dangling edges**: Ports not in arrow node must have no external connections
- **Total morphism**: AHP matching requires total morphisms
- **Recursive matching**: Ladder graphs need recursive morphism search

### 2. Port System
- **Port Types**: Support bridge, black-hole, and wire semantics
- **Connection Management**: Handle dynamic rewiring during rewrites
- **Port Attributes**: Add rewrite-related metadata

### 3. Propagation Logic
- **Rewrite Triggers**: When and how rewrites are triggered
- **State Consistency**: Ensure network remains consistent during rewrites
- **Cycle Handling**: Handle rewrites that create or break cycles

### 4. Merge Functions
- **Rewrite Rule Merging**: How multiple applicable rules are combined
- **Conflict Resolution**: Handle conflicting rewrite applications
- **Convergence**: Ensure rewrite sequences terminate

## Implementation Strategy

### 1. Start Simple
- Begin with basic arrow node and simple rewrite rules
- Focus on flat graphs before hierarchical ones
- Implement basic pattern matching without complex conditions

### 2. Build Incrementally
- Add port type handling one at a time
- Implement strategy language gradually
- Add hierarchical features after basic rewriting works

### 3. Test Thoroughly
- Create comprehensive test suite for rewrite rules
- Test edge cases in pattern matching
- Verify rewrite termination and convergence

### 4. Performance Considerations
- Optimize pattern matching algorithms
- Cache frequently used patterns
- Implement lazy evaluation where possible

## Example Use Cases

### 1. Constraint System Optimization
```typescript
// Rule: Simplify redundant constraints
const simplifyRule = [
  'rewrite-rule',
  'simplify-constraints',
  {
    leftPattern: ['graph', 
      ['gadget', 'cell', variable('cellA'), { type: 'cell' }],
      ['gadget', 'cell', variable('cellB'), { type: 'cell' }],
      ['gadget', 'adder', variable('adder'), { type: 'adder' }]
    ],
    rightPattern: ['graph', 
      ['gadget', 'cell', variable('cellA'), { type: 'cell' }]
    ],
    arrowNode: ['arrow', 
      ['bridge', variable('cellA')],           // survives
      ['black-hole', variable('cellB'), variable('adder')]  // deleted
    ],
    conditions: ['cells-equal', variable('cellA'), variable('cellB')]
  }
]
```

### 2. Graph Variable and Interface Matching
```typescript
// Rule: Replace complex subgraph with optimized version
const optimizeSubgraphRule = [
  'rewrite-rule',
  'optimize-subgraph',
  {
    leftPattern: ['graph',
      ['node', 'container', {
        ladder: graphVariable('?subgraph', {
          interface: ['input', 'output'],
          constraints: ['type', 'cell']
        }),
        interface: ['input', 'output']
      }]
    ],
    rightPattern: ['graph',
      ['gadget', 'optimized', variable('name'), { type: 'optimized' }]
    ],
    arrowNode: ['arrow',
      ['bridge', 'input', 'output']  // interface ports survive
    ],
    conditions: ['complexity-threshold-exceeded']
  }
]
```

### 2. Network Topology Evolution
```typescript
// Rule: Split complex gadgets into simpler ones
const splitRule = [
  'rewrite-rule',
  'split-complex-gadget',
  {
    leftPattern: ['graph', ['complex-gadget', 'input', 'output']],
    rightPattern: ['graph', ['simple-gadget', 'input'], ['simple-gadget', 'output']],
    arrowNode: ['arrow', ['wire', 'input', 'output']],
    conditions: ['complexity-threshold-exceeded']
  }
]
```

### 3. Adaptive Computation
```typescript
// Rule: Optimize based on usage patterns
const optimizeRule = [
  'rewrite-rule',
  'optimize-for-frequency',
  {
    leftPattern: ['graph', ['gadget', 'input', 'output']],
    rightPattern: ['graph', ['optimized-gadget', 'input', 'output']],
    arrowNode: ['arrow', ['bridge', 'input', 'output']],
    conditions: ['high-frequency-usage']
  }
]
```

## Benefits

### 1. Leverages Existing System
- **No separate rewrite engine** - uses our existing constraint solver
- **Existing merge functions** handle conflicts and contradictions
- **Existing propagation network** handles all the heavy lifting

### 2. Simple TMS Architecture
- **Three cells**: all-premises, nogoods, believed-premises
- **Automatic refinement**: believed = all - nogoods
- **No manual backtracking** - pure propagation with feedback loops

### 3. Generic Contradiction Handling
- **Merge functions return contradictions** instead of throwing errors
- **Generic contradiction terms** - not tied to specific premise types
- **Automatic propagation** back to TMS for refinement

### 4. Elegant Composition
- **Rewrite rules become premises** in the TMS
- **Contradictions automatically refine** the premise set
- **Natural constraint satisfaction** - our system already handles this

## Challenges and Considerations

### 1. Pattern Matching Complexity
- Graph isomorphism is computationally expensive
- Need efficient algorithms for large networks
- Consider approximate matching for performance

### 2. Rewrite Termination
- Ensure rewrite sequences don't loop infinitely
- Implement termination conditions and limits
- Consider using well-founded orderings

### 3. State Consistency
- Maintain network invariants during rewrites
- Handle partial rewrite failures gracefully
- Ensure atomicity of rewrite operations

### 4. Performance Impact
- Rewrite rules add overhead to normal operation
- Need to balance flexibility with performance
- Consider lazy evaluation and caching strategies

## Next Steps

1. **Implement basic arrow node gadget**
2. **Create simple pattern matching engine**
3. **Add basic rewrite rule execution**
4. **Integrate with existing term system**
5. **Test with simple constraint optimization**
6. **Add strategic control**
7. **Implement hierarchical features**
8. **Performance optimization**

## Conclusion

Adding term rewriting with graph rewrites will transform our system from a static network architecture into a dynamic, self-evolving computational framework. The arrow node concept from AHP provides a clean, powerful way to represent transformations as graphs themselves, maintaining the uniform term-based approach that makes our system so elegant.

This implementation will enable:
- **Self-optimizing networks** that adapt to usage patterns
- **Declarative network evolution** through pattern-based rules
- **Hierarchical abstraction** for complex systems
- **Strategic control** over network transformations

The result will be a system that can not only solve constraints but can also optimize itself, adapt to changing requirements, and evolve its own structure - all while maintaining the clean, term-based architecture that makes it so powerful.
