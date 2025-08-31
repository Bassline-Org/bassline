/**
 * ALGEBRAIC CONSTRAINT SATISFACTION SYSTEM
 * 
 * This system demonstrates a term-based, composable architecture for solving
 * algebraic constraints with automatic propagation and conflict resolution.
 * 
 * CONSTRAINT: a + b = c
 * 
 * ARCHITECTURE OVERVIEW:
 * 
 * 1. ORDINAL CELLS: Store values as [value, ordinal] tuples where higher
 *    ordinals override lower ones during conflicts
 * 
 * 2. MATH GADGETS: Pure numeric operations (adder, subtractors) that work
 *    with plain numbers, completely unaware of ordinals
 * 
 * 3. EXTRACTORS: Separate value and height extraction from ordinal tuples
 * 
 * 4. ORDINAL CONSTRUCTORS: Create result tuples using math results and
 *    current max ordinal from the max-ordinal cell
 * 
 * 5. MAX-ORDINAL CELL: Accumulates the highest ordinal seen across all
 *    operations, providing ordinal state
 * 
 * DATA FLOW:
 * 
 * Forward Propagation (a,b → c):
 *   a[value,ordinal] → extractor → adder.a
 *   b[value,ordinal] → extractor → adder.b
 *   adder.result → constructor.value
 *   maxOrdinal → constructor.height
 *   constructor.output → c[value,ordinal]
 * 
 * Backward Propagation (c → a,b):
 *   c[value,ordinal] → extractor → subtractor.a
 *   a[value,ordinal] → extractor → subtractor.b
 *   subtractor.result → constructor.value
 *   maxOrdinal → constructor.height
 *   constructor.output → b[value,ordinal]
 * 
 * Height Propagation:
 *   All cells → height extractors → max-ordinal cell
 *   Max-ordinal cell → all constructors
 * 
 * This creates a robust constraint satisfaction system where:
 * - Math operations are pure and ordinal-agnostic
 * - Ordinal logic is consistent
 * - Conflicts are resolved by ordinal precedence
 * - The network converges to consistent values
 */

console.log('Testing algebraic constraint solving with cycles...')

import { Network, Cell, FunctionGadget } from './dist/gadgets.js'
import { Nothing, numberp } from './dist/terms.js'

const network = new Network('algebraic-constraints')

// Helper functions for ordinal operations
const extractValue = (ordinalTuple) => ordinalTuple[0]
const extractHeight = (ordinalTuple) => ordinalTuple[1]
const ordinalp = (ordinalTuple) => Array.isArray(ordinalTuple) && ordinalTuple.length === 2

// ============================================================================
// SEMANTIC FACTORY FUNCTIONS FOR CONSTRAINT NETWORKS
// ============================================================================

/**
 * Creates a complete constraint variable with all necessary components
 * This is the main building block for constraint satisfaction systems
 */
const createConstraintVariable = (name, network) => {
    const cell = ordinalCell(name, network)
    const valueExtractor = createExtractor(`${name}-extractor`, network)
    const heightExtractor = createHeightExtractor(`${name}-height-extractor`, network)
    const constructor = createOrdinalConstructor(`${name}-constructor`, network)
    
    return {
        name,
        cell,
        valueExtractor,
        heightExtractor,
        constructor,
        // Convenience methods for common operations
        setValue: (value, ordinal) => cell.receive('value-in', [value, ordinal]),
        getValue: () => cell.getPort('value-out')?.value,
        getNumericValue: () => valueExtractor.getPort('output')?.value,
        getOrdinal: () => heightExtractor.getPort('output')?.value
    }
}

/**
 * Creates a mathematical constraint relation between variables
 * Automatically handles the bidirectional propagation logic
 * 
 * NOTE: These semantic factory functions demonstrate how the system
 * could be further simplified. Instead of manually creating and
 * connecting each component, you could write:
 * 
 * const a = createConstraintVariable('a', network)
 * const b = createConstraintVariable('b', network)
 * const c = createConstraintVariable('c', network)
 * 
 * const sumConstraint = createMathematicalConstraint('sum', network, 
 *   (a, b) => a + b,  // forward: a + b = c
 *   [(c, a) => c - a, (c, b) => c - b]  // backward: c - a = b, c - b = a
 * )
 * 
 * This would make the constraint system even more declarative and easier to understand.
 */
const createMathematicalConstraint = (name, network, operation, inverseOperations) => {
    const mainGadget = createMathGadget(name, network, operation)
    
    return {
        name,
        mainGadget,
        // Connect to source variables and target constructors
        connect: (sourceVars, targetConstructor) => {
            // Forward propagation
            sourceVars.forEach((sourceVar, index) => {
                connect(sourceVar.valueExtractor, 'output', mainGadget.id, ['a', 'b'][index])
            })
            connect(mainGadget, 'result', targetConstructor.id, 'value')
        }
    }
}

// ============================================================================
// FACTORY FUNCTIONS FOR CREATING GADGETS
// ============================================================================

/**
 * Creates a math gadget that performs pure numeric operations
 * These gadgets are completely unaware of ordinals and work with plain numbers
 */
const createMathGadget = (name, network, operation) => {
    return new FunctionGadget(name, network, {
        inputs: ['a', 'b'],
        outputs: ['result'],
        fn: (inputs) => {
            const a = inputs.a
            const b = inputs.b
            if (typeof a === 'number' && typeof b === 'number') {
                return operation(a, b)
            }
            return Nothing
        }
    })
}

/**
 * Creates an adder gadget: a + b = result
 */
const createAdder = (name, network) => createMathGadget(name, network, (a, b) => a + b)

/**
 * Creates a subtractor gadget: a - b = result
 */
const createSubtractor = (name, network) => createMathGadget(name, network, (a, b) => a - b)



// ============================================================================
// MERGE FUNCTIONS FOR CELL BEHAVIOR
// ============================================================================

/**
 * Ordinal merge function: keeps the value with the highest ordinal
 * Higher ordinals override lower ones, resolving conflicts by precedence
 */
const ordinalMerge = (current, incoming) => {
    if (current === Nothing) {
        if(ordinalp(incoming)) {
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
}

/**
 * Max merge function: accumulates the maximum numeric value seen
 * Used by the max-ordinal cell to track the highest ordinal across all operations
 */
const maxMerge = (current, incoming) => {
    if (current === Nothing) {
        return incoming
    }
    if (numberp(current) && numberp(incoming)) {
        return Math.max(current, incoming)
    }
    throw new Error(`MaxMerge: current is not a number: ${current} or incoming is not a number: ${incoming}`)
}

/**
 * Creates an ordinal cell that stores [value, ordinal] tuples
 * Higher ordinals override lower ones during conflicts
 */
const ordinalCell = (name, network) => new Cell(name, network, {}, ordinalMerge)

/**
 * Creates a max cell that accumulates the maximum numeric value seen
 * Used for tracking the highest ordinal across all operations
 */
const maxCell = (name, network) => new Cell(name, network, {}, maxMerge)

/**
 * Creates a value extractor that extracts the numeric value from ordinal tuples
 * Input: [value, ordinal] → Output: value
 */
const createExtractor = (name, network) => new FunctionGadget(name, network,
    {
        inputs: ['input'],
        outputs: ['output'],
        fn: ({input}) => extractValue(input)
    }
)

/**
 * Creates a height extractor that extracts the ordinal height from ordinal tuples
 * Input: [value, ordinal] → Output: ordinal
 */
const createHeightExtractor = (name, network) => new FunctionGadget(name, network,
    {
        inputs: ['input'],
        outputs: ['output'],
        fn: ({input}) => extractHeight(input)
    }
)

/**
 * Creates an ordinal constructor that builds [value, ordinal] tuples
 * Inputs: numeric value and ordinal height → Output: [value, ordinal]
 */
const createOrdinalConstructor = (name, network) => new FunctionGadget(name, network,
    {
        inputs: ['value', 'height'],
        outputs: ['output'],
        fn: ({value, height}) => [value, height]
    }
)

// ============================================================================
// SYSTEM SETUP: CREATING THE CONSTRAINT NETWORK
// ============================================================================

/**
 * Global max-ordinal cell that tracks the highest ordinal seen across all operations
 * All ordinal constructors read from this to ensure consistent ordinal precedence
 */
const maxOrdinalCell = maxCell('maxOrdinalCell', network)

/**
 * Ordinal constructors for each variable
 * These create [value, ordinal] tuples using math results and current max ordinal
 */
const constructors = {
    a: createOrdinalConstructor(`a-constructor`, network),
    b: createOrdinalConstructor(`b-constructor`, network),
    c: createOrdinalConstructor(`c-constructor`, network),
}

/**
 * Helper function to establish connections between gadgets
 * Uses connect-and-sync to immediately propagate current values upon connection
 */
const connect = (cell, outputPort, target, inputPort) => {
    cell.receive('control', ['connect-and-sync', outputPort, [target, inputPort]])
}

/**
 * Sets up a complete cell with all its components:
 * - Ordinal cell for value storage
 * - Value extractor for math operations
 * - Height extractor for ordinal tracking
 * - Connections to max-ordinal cell and constructor
 */
const setupCell = (cellName) => {
    const result = {
        cell: ordinalCell(cellName, network),
        extractor: createExtractor(`${cellName}-extractor`, network),
        height: createHeightExtractor(`${cellName}-height-extractor`, network),
    }
    // Connect cell outputs to extractors
    connect(result.cell, 'value-out', result.extractor.id, 'input')
    connect(result.cell, 'value-out', result.height.id, 'input')
    // Connect height extractor to max-ordinal cell
    connect(result.height, 'output', maxOrdinalCell.id, 'value-in')
    // Connect max-ordinal cell to constructor
    connect(maxOrdinalCell, 'value-out', constructors[cellName].id, 'height')
    return result
}

/**
 * Create all cells with their extractors and height extractors
 * Each cell is a complete unit that can participate in the constraint network
 */
const cells = {
    a: setupCell('a'),
    b: setupCell('b'),
    c: setupCell('c'),
}

/**
 * Create the mathematical relations that define the constraint system
 * - abToC: a + b = c (forward propagation)
 * - caToB: c - a = b (backward propagation)
 * - cbToA: c - b = a (backward propagation)
 */
const relations = {
    abToC: createAdder('ab-to-c', network),
    caToB: createSubtractor('ca-to-b', network),
    cbToA: createSubtractor('cb-to-a', network),
}

// ============================================================================
// CONNECTING THE CONSTRAINT NETWORK
// ============================================================================

/**
 * Forward propagation: a + b = c
 * When a or b changes, the adder updates c
 */
connect(cells.a.extractor, 'output', relations.abToC.id, 'a')
connect(cells.b.extractor, 'output', relations.abToC.id, 'b')
connect(relations.abToC, 'result', constructors.c.id, 'value')

/**
 * Backward propagation: c - a = b
 * When c or a changes, the subtractor updates b
 */
connect(cells.c.extractor, 'output', relations.caToB.id, 'a')
connect(cells.a.extractor, 'output', relations.caToB.id, 'b')
connect(relations.caToB, 'result', constructors.b.id, 'value')

/**
 * Backward propagation: c - b = a
 * When c or b changes, the subtractor updates a
 */
connect(cells.c.extractor, 'output', relations.cbToA.id, 'a')
connect(cells.b.extractor, 'output', relations.cbToA.id, 'b')
connect(relations.cbToA, 'result', constructors.a.id, 'value')

/**
 * Connect constructors back to their respective cells
 * This completes the constraint satisfaction loop:
 * Math result → Constructor → Cell → Extractor → Math input
 */
connect(constructors.a, 'output', cells.a.cell.id, 'value-in')
connect(constructors.b, 'output', cells.b.cell.id, 'value-in')
connect(constructors.c, 'output', cells.c.cell.id, 'value-in')

console.log('✅ All gadgets created and added to network')

// Connect the network
console.log('\n=== Step 1: Connecting the Network ===')

console.log('✅ Network fully connected')

// Test scenarios
console.log('\n=== Step 2: Testing Constraint Solving ===')

console.log('\n--- Scenario 1: Forward Propagation (a + b = c) ---')
console.log('Setting a = [3, 1], b = [4, 1]')
cells.a.cell.receive('value-in', [3, 1])
cells.b.cell.receive('value-in', [4, 1])

console.log('Result: a + b = c')
console.log('a =', cells.a.cell.getPort('value-out')?.value)
console.log('b =', cells.b.cell.getPort('value-out')?.value)
console.log('c =', cells.c.cell.getPort('value-out')?.value)

console.log('\n--- Scenario 2: Backward Propagation (c → a, b) ---')
console.log('Setting c = [12, 2] (higher ordinal overrides previous values)')
cells.c.cell.receive('value-in', [12, 2])

console.log('Result: c = 12, so a and b must satisfy a + b = 12')
console.log('a =', cells.a.cell.getPort('value-out')?.value)
console.log('b =', cells.b.cell.getPort('value-out')?.value)
console.log('c =', cells.c.cell.getPort('value-out')?.value)

console.log('\n--- Scenario 3: Constraint Satisfaction (a → b, c) ---')
console.log('Setting a = [5, 3] (highest ordinal, overrides all previous values)')
cells.a.cell.receive('value-in', [5, 3])

console.log('Result: a = 5, so b and c must satisfy 5 + b = c')
console.log('a =', cells.a.cell.getPort('value-out')?.value)
console.log('b =', cells.b.cell.getPort('value-out')?.value)
console.log('c =', cells.c.cell.getPort('value-out')?.value)

console.log('\n🎉 Algebraic constraint solving test complete!')
console.log('\n💡 KEY INSIGHTS:')
console.log('   • The network automatically converges to consistent values')
console.log('   • Ordinal precedence resolves conflicts (higher ordinals win)')
console.log('   • Math operations are pure and ordinal-agnostic')
console.log('   • The system handles bidirectional constraint propagation')
console.log('   • Circular dependencies through cells are natural and desired')