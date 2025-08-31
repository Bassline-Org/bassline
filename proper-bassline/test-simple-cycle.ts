import { PortGraphInterpreter } from './src/interpreter'
import { GraphRegistry, PortGraph, GadgetRecord, PortRecord, ConnectionRecord, GadgetId, PortId, ConnectionId } from 'port-graphs'

const registry = new GraphRegistry()
const graph = registry.newGraph('graph-test-simple-cycle')
const interpreter = new PortGraphInterpreter(registry)

// Create 2 MaxCells: A -> B -> A
const cellA: GadgetRecord = {
  name: 'gadget-a',
  recordType: 'gadget',
  type: 'cell',
  primitiveName: 'MaxCell',
  ladder: null
}
const cellB: GadgetRecord = {
  name: 'gadget-b',
  recordType: 'gadget',
  type: 'cell',
  primitiveName: 'MaxCell',
  ladder: null
}
graph.addGadget(cellA)
graph.addGadget(cellB)

// Create ports
const portAIn: PortRecord = {
  name: 'port-a-in',
  recordType: 'port',
  portName: 'value',
  type: 'number',
  direction: 'input',
  position: 'left',
  gadget: 'gadget-a',
  currentValue: null
}
const portAOut: PortRecord = {
  name: 'port-a-out',
  recordType: 'port',
  portName: 'value',
  type: 'number',
  direction: 'output',
  position: 'right',
  gadget: 'gadget-a',
  currentValue: null
}

const portBIn: PortRecord = {
  name: 'port-b-in',
  recordType: 'port',
  portName: 'value',
  type: 'number',
  direction: 'input',
  position: 'left',
  gadget: 'gadget-b',
  currentValue: null
}
const portBOut: PortRecord = {
  name: 'port-b-out',
  recordType: 'port',
  portName: 'value',
  type: 'number',
  direction: 'output',
  position: 'right',
  gadget: 'gadget-b',
  currentValue: null
}

graph.addPort(portAIn)
graph.addPort(portAOut)
graph.addPort(portBIn)
graph.addPort(portBOut)

// Create cycle: A -> B -> A
const connAB: ConnectionRecord = {
  name: 'connection-a-b',
  recordType: 'connection',
  source: 'port-a-out',
  target: 'port-b-in'
}
const connBA: ConnectionRecord = {
  name: 'connection-b-a',
  recordType: 'connection',
  source: 'port-b-out',
  target: 'port-a-in'
}
graph.addEdge(connAB)
graph.addEdge(connBA)

console.log('Initial state:')
console.log('A out:', portAOut.currentValue)
console.log('B out:', portBOut.currentValue)

// Inject value 5 into cell A
console.log('\nInjecting 5 into A...')
console.log('Graph ID:', graph.id)
console.log('Port exists?', graph.records['port-a-in'] !== undefined)
console.log('Port gadget:', (graph.records['port-a-in'] as PortRecord)?.gadget)
interpreter.setPortValue(graph.id, 'port-a-in', 5)

console.log('\nAfter injection:')
console.log('A in:', portAIn.currentValue)
console.log('A out:', portAOut.currentValue)
console.log('B in:', portBIn.currentValue)
console.log('B out:', portBOut.currentValue)

// Inject value 10 into cell B
console.log('\nInjecting 10 into B...')
interpreter.setPortValue(graph.id, 'port-b-in', 10)

console.log('\nAfter second injection:')
console.log('A in:', portAIn.currentValue)
console.log('A out:', portAOut.currentValue)
console.log('B in:', portBIn.currentValue)
console.log('B out:', portBOut.currentValue)