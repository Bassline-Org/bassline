// Test algebraic constraint solving with cycles
// System: a + b = c, with subtractors and OrdinalCells for convergence
console.log('Testing algebraic constraint solving with cycles...')

import { Network, Cell, FunctionGadget } from './dist/gadgets.js'
import { Nothing, numberp } from './dist/terms.js'

const network = new Network('algebraic-constraints')

// Helper functions for ordinal operations
const createOrdinalTuple = (value, ordinal) => [value, ordinal]
const extractValue = (ordinalTuple) => ordinalTuple[0]
const extractHeight = (ordinalTuple) => ordinalTuple[1]
const ordinalp = (ordinalTuple) => Array.isArray(ordinalTuple) && ordinalTuple.length === 2

// Helper function to create math operation gadgets (pure numeric operations)
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

const createAdder = (name, network) => createMathGadget(name, network, (a, b) => a + b)
const createSubtractor = (name, network) => createMathGadget(name, network, (a, b) => a - b)

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

const maxMerge = (current, incoming) => {
    if (current === Nothing) {
        return incoming
    }
    if (numberp(current) && numberp(incoming)) {
        return Math.max(current, incoming)
    }
    throw new Error(`MaxMerge: current is not a number: ${current} or incoming is not a number: ${incoming}`)
}

const ordinalCell = (name, network) => new Cell(name, network, {}, ordinalMerge)
const maxCell = (name, network) => new Cell(name, network, {}, maxMerge)

const createExtractor = (name, network) => new FunctionGadget(name, network,
    {
        inputs: ['input'],
        outputs: ['output'],
        fn: ({input}) => extractValue(input)
    }
)

const createHeightExtractor = (name, network) => new FunctionGadget(name, network,
    {
        inputs: ['input'],
        outputs: ['output'],
        fn: ({input}) => extractHeight(input)
    }
)

const createOrdinalConstructor = (name, network) => new FunctionGadget(name, network,
    {
        inputs: ['value', 'height'],
        outputs: ['output'],
        fn: ({value, height}) => [value, height]
    }
)

// Create the max ordinal cell
const maxOrdinalCell = maxCell('maxOrdinalCell', network)

const constructors = {
    a: createOrdinalConstructor(`a-constructor`, network),
    b: createOrdinalConstructor(`b-constructor`, network),
    c: createOrdinalConstructor(`c-constructor`, network),
}

const connect = (cell, outputPort, target, inputPort) => {
    cell.receive('control', ['connect-and-sync', outputPort, [target, inputPort]])
}

const setupCell = (cellName) => {
    const result = {
        cell: ordinalCell(cellName, network),
        extractor: createExtractor(`${cellName}-extractor`, network),
        height: createHeightExtractor(`${cellName}-height-extractor`, network),
    }
    connect(result.cell, 'value-out', result.extractor.id, 'input')
    connect(result.cell, 'value-out', result.height.id, 'input')
    connect(result.height, 'output', maxOrdinalCell.id, 'value-in')
    connect(maxOrdinalCell, 'value-out', constructors[cellName].id, 'height')
    // Don't connect constructor output back to the same cell - that creates a circular dependency
    return result
}

const cells = {
    a: setupCell('a'),
    b: setupCell('b'),
    c: setupCell('c'),
}

const relations = {
    abToC: createAdder('ab-to-c', network),
    caToB: createSubtractor('ca-to-b', network),
    cbToA: createSubtractor('cb-to-a', network),
}

connect(cells.a.extractor, 'output', relations.abToC.id, 'a')
connect(cells.b.extractor, 'output', relations.abToC.id, 'b')
connect(relations.abToC, 'result', constructors.c.id, 'value')

connect(cells.c.extractor, 'output', relations.caToB.id, 'a')
connect(cells.a.extractor, 'output', relations.caToB.id, 'b')
connect(relations.caToB, 'result', constructors.b.id, 'value')

connect(cells.c.extractor, 'output', relations.cbToA.id, 'a')
connect(cells.b.extractor, 'output', relations.cbToA.id, 'b')
connect(relations.cbToA, 'result', constructors.a.id, 'value')

// Connect constructors to their respective cells
connect(constructors.a, 'output', cells.a.cell.id, 'value-in')
connect(constructors.b, 'output', cells.b.cell.id, 'value-in')
connect(constructors.c, 'output', cells.c.cell.id, 'value-in')

console.log('C: ', cells.c.cell.getPort('value-in'))

console.log('✅ All gadgets created and added to network')

// Connect the network
console.log('\n=== Step 1: Connecting the Network ===')

console.log('✅ Network fully connected')

// Test scenarios
console.log('\n=== Step 2: Testing Constraint Solving ===')

console.log('\n--- Scenario 1: Set a = [3, 1], b = [4, 1] ---')
cells.a.cell.receive('value-in', [3, 1])
cells.b.cell.receive('value-in', [4, 1])

console.log('After setting a=[3,1], b=[4,1]:')
console.log('a =', cells.a.cell.getPort('value-out')?.value)
console.log('b =', cells.b.cell.getPort('value-out')?.value)
console.log('c =', cells.c.cell.getPort('value-out')?.value)

console.log('C connections', cells.c.cell.getPort('value-in').getConnections())
console.log('Max ordinal cell value:', maxOrdinalCell.getPort('value-out')?.value)
console.log('C constructor value input:', constructors.c.getPort('value')?.value)
console.log('C constructor height input:', constructors.c.getPort('height')?.value)
console.log('A height extractor output:', cells.a.height.getPort('output')?.value)
console.log('B height extractor output:', cells.b.height.getPort('output')?.value)
console.log('C height extractor output:', cells.c.height.getPort('output')?.value)

console.log('\n--- Scenario 2: Set c = [12, 2] ---')
cells.c.cell.receive('value-in', [12, 2])

console.log('After setting c=[12,2]:')
console.log('a =', cells.a.cell.getPort('value-out')?.value)
console.log('b =', cells.b.cell.getPort('value-out')?.value)
console.log('c =', cells.c.cell.getPort('value-out')?.value)
console.log('Max ordinal after c=[12,2]:', maxOrdinalCell.getPort('value-out')?.value)
console.log('C height extractor after c=[12,2]:', cells.c.height.getPort('output')?.value)

console.log('\n--- Scenario 3: Set a = [5, 3] ---')
cells.a.cell.receive('value-in', [5, 3])

console.log('After setting a=[5,3]:')
console.log('a =', cells.a.cell.getPort('value-out')?.value)
console.log('b =', cells.b.cell.getPort('value-out')?.value)
console.log('c =', cells.c.cell.getPort('value-out')?.value)
console.log('Max ordinal after a=[5,3]:', maxOrdinalCell.getPort('value-out')?.value)
console.log('A height extractor after a=[5,3]:', cells.a.height.getPort('output')?.value)
console.log('Subtractor caToB inputs - a:', relations.caToB.getPort('a')?.value, 'c:', relations.caToB.getPort('c')?.value)
console.log('Subtractor caToB result:', relations.caToB.getPort('result')?.value)
console.log('C extractor output:', cells.c.extractor.getPort('output')?.value)
console.log('C cell value-out:', cells.c.cell.getPort('value-out')?.value)

console.log('\n🎉 Algebraic constraint solving test complete!')
console.log('💡 The network should converge to consistent values')
console.log('💡 OrdinalCells ensure we get the value with highest ordinal when constraints conflict')


