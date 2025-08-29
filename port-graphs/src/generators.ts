// Simple propagation network leveraging MAIC properties
import { PortId, JsonValue, GadgetId, ConnectionId } from "./types"

// Network container class - manages objects, not IDs
class Network {
    private ports = new Map<PortId, Port<JsonValue>>()
    private cells = new Map<GadgetId, Cell<JsonValue>>()
    private propagators = new Map<GadgetId, Propagator>()
    private connections = new Map<ConnectionId, { source: Port<JsonValue>, target: Port<JsonValue> }>()
    private cellFunctionRegistry = new Map<string, (current: JsonValue | undefined, incoming: JsonValue) => JsonValue>()
    private propagatorFunctionRegistry = new Map<string, (...args: JsonValue[]) => JsonValue>()
    public attributes: Record<string, unknown> = {}
    
    constructor(attributes: Record<string, unknown> = {}) {
        this.attributes = attributes
        // Register some default cell functions
        this.registerCellFunction('max', (current: JsonValue | undefined, incoming: JsonValue) => {
            if (typeof current === 'number' && typeof incoming === 'number') {
                return current === undefined ? incoming : Math.max(current, incoming)
            }
            return incoming
        })
        this.registerCellFunction('min', (current: JsonValue | undefined, incoming: JsonValue) => {
            if (typeof current === 'number' && typeof incoming === 'number') {
                return current === undefined ? incoming : Math.min(current, incoming)
            }
            return incoming
        })
        
        // Register some default propagator functions
        this.registerPropagatorFunction('add', (a: JsonValue, b: JsonValue) => {
            if (typeof a === 'number' && typeof b === 'number') {
                return a + b
            }
            return 0
        })
        this.registerPropagatorFunction('multiply', (a: JsonValue, b: JsonValue) => {
            if (typeof a === 'number' && typeof b === 'number') {
                return a * b
            }
            return 0
        })
        this.registerPropagatorFunction('or', (a: JsonValue, b: JsonValue) => {
            if (typeof a === 'boolean' && typeof b === 'boolean') {
                return a || b
            }
            return false
        })
        this.registerPropagatorFunction('and', (a: JsonValue, b: JsonValue) => {
            if (typeof a === 'boolean' && typeof b === 'boolean') {
                return a && b
            }
            return false
        })
    }
    
    // Function registry methods
    registerCellFunction(name: string, fn: (current: JsonValue | undefined, incoming: JsonValue) => JsonValue): void {
        this.cellFunctionRegistry.set(name, fn)
    }
    
    registerPropagatorFunction(name: string, fn: (...args: JsonValue[]) => JsonValue): void {
        this.propagatorFunctionRegistry.set(name, fn)
    }
    
    getCellFunction(name: string): ((current: JsonValue | undefined, incoming: JsonValue) => JsonValue) | undefined {
        return this.cellFunctionRegistry.get(name)
    }
    
    getPropagatorFunction(name: string): ((...args: JsonValue[]) => JsonValue) | undefined {
        return this.propagatorFunctionRegistry.get(name)
    }
    
    addPort(port: Port<JsonValue>): void {
        this.ports.set(port.getId(), port)
    }
    
    addCell(cell: Cell<JsonValue>, gadgetId: GadgetId): void {
        this.cells.set(gadgetId, cell)
        cell.attributes['gadgetId'] = gadgetId
        this.addPort(cell.getOutputPort())
    }
    
    addPropagator(propagator: Propagator, gadgetId: GadgetId): void {
        this.propagators.set(gadgetId, propagator)
        propagator.attributes['gadgetId'] = gadgetId
        this.addPort(propagator.getOutputPort())
        propagator.getInputPorts().forEach(port => this.addPort(port))
    }
    
    getPort(portId: PortId): Port<JsonValue> | undefined {
        return this.ports.get(portId)
    }
    
    // Connect ports directly - no ID lookup needed
    connect(sourcePort: Port<JsonValue>, targetPort: Port<JsonValue>, connectionId?: ConnectionId): void {
        const id = connectionId || `connection-${sourcePort.getId()}-${targetPort.getId()}` as ConnectionId
        this.connections.set(id, { source: sourcePort, target: targetPort })
        sourcePort.connect(targetPort)
    }
    
    // Serialization
    static fromRecord(record: Record<string, unknown>): Network {
        const network = new Network(record['attributes'] as Record<string, unknown>)
        
        // Create ports first
        const ports = record['ports'] as Array<Record<string, unknown>> || []
        ports.forEach((portRecord) => {
            const port = Port.fromRecord(portRecord)
            network.addPort(port)
        })
        
        // Create gadgets (cells and propagators)
        const gadgets = record['gadgets'] as Array<Record<string, unknown>> || []
        gadgets.forEach((gadgetRecord) => {
            if (gadgetRecord['type'] === 'cell') {
                Cell.fromRecord(gadgetRecord, network)
            } else if (gadgetRecord['type'] === 'function') {
                Propagator.fromRecord(gadgetRecord, network)
            }
        })
        
        // Create connections
        const connections = record['connections'] as Array<Record<string, unknown>> || []
        connections.forEach((connRecord) => {
            const sourcePort = network.getPort(connRecord['source'] as PortId)
            const targetPort = network.getPort(connRecord['target'] as PortId)
            if (sourcePort && targetPort) {
                network.connect(sourcePort, targetPort, connRecord['name'] as ConnectionId)
            }
        })
        
        return network
    }
    
    toRecord(): any {
        return {
            ports: Array.from(this.ports.values()).map(port => port.toRecord()),
            gadgets: [
                ...Array.from(this.cells.values()).map(cell => cell.toRecord()),
                ...Array.from(this.propagators.values()).map(prop => prop.toRecord())
            ],
            connections: Array.from(this.connections.entries()).map(([id, conn]) => ({
                name: id,
                recordType: 'connection' as const,
                source: conn.source.getId(),
                target: conn.target.getId()
            })),
            attributes: this.attributes
        }
    }
    
    destroy(): void {
        this.cells.forEach(cell => cell.destroy())
        this.propagators.forEach(prop => prop.destroy())
        this.ports.forEach(port => port.destroy())
        this.cells.clear()
        this.propagators.clear()
        this.ports.clear()
        this.connections.clear()
    }
}

class Port<T = JsonValue> {
    private value: T | undefined
    private listeners = new Set<(value: T) => void>()
    public attributes: Record<string, unknown> = {}
    
    constructor(private portId: PortId, attributes: Record<string, unknown> = {}) {
        this.attributes = attributes
    }
    
    setValue(value: T): void {
        if (this.value !== value) {
            this.value = value
            this.listeners.forEach(listener => listener(value))
        }
    }
    
    getValue(): T | undefined { return this.value }
    
    subscribe(listener: (value: T) => void): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }
    
    connect(other: Port<T>): () => void {
        const un1 = this.subscribe(value => other.setValue(value))
        const un2 = other.subscribe(value => this.setValue(value))
        return () => { un1(); un2() }
    }
    
    destroy(): void {
        this.listeners.clear()
        this.value = undefined
    }
    
    // Getter for portId to avoid private access issues
    getId(): PortId { return this.portId }
    
    // Serialization
    static fromRecord(record: any): Port<JsonValue> {
        const port = new Port(record.name, record.attributes || {})
        if (record.currentValue !== null) {
            port.setValue(record.currentValue)
        }
        return port
    }
    
    toRecord(): any {
        return {
            name: this.portId,
            recordType: 'port',
            portName: (this.attributes['portName'] as string) || 'port',
            type: (this.attributes['type'] as string) || 'any',
            direction: (this.attributes['direction'] as 'input' | 'output' | 'bidirectional') || 'bidirectional',
            position: (this.attributes['position'] as 'top' | 'bottom' | 'left' | 'right') || 'top',
            gadget: (this.attributes['gadget'] as GadgetId | null) || null,
            currentValue: this.value as JsonValue,
            attributes: this.attributes
        }
    }
}

class Cell<T = JsonValue> {
    private value: T | undefined
    private unsubs: (() => void)[] = []
    public attributes: Record<string, unknown> = {}
    
    constructor(
        private mergeFn: (current: T | undefined, incoming: T) => T,
        private outputPort: Port<T>,
        attributes: Record<string, unknown> = {}
    ) {
        this.attributes = attributes
    }
    
    accept(incoming: T): void {
        const newValue = this.mergeFn(this.value, incoming)
        if (newValue !== this.value) {
            this.value = newValue
            this.outputPort.setValue(newValue)
        }
    }
    
    connectInput(inputPort: Port<T>): () => void {
        const unsub = inputPort.subscribe(value => this.accept(value))
        this.unsubs.push(unsub)
        return unsub
    }
    
    getOutputPort(): Port<T> { return this.outputPort }
    
    destroy(): void {
        this.unsubs.forEach(unsub => unsub())
        this.unsubs = []
        this.value = undefined
    }
    
    // Serialization
    static fromRecord(record: Record<string, unknown>, network: Network): Cell<JsonValue> {
        const primitiveFn = record['primitiveName'] as string
        const mergeFn = network.getCellFunction(primitiveFn)
        if (!mergeFn) {
            throw new Error(`Unknown primitive function: ${primitiveFn}`)
        }
        
        const outputPort = network.getPort(record['outputPortId'] as PortId) || 
                          new Port(record['outputPortId'] as PortId, { direction: 'output', gadget: record['name'] })
        
        const cell = new Cell(mergeFn, outputPort, record['attributes'] as Record<string, unknown>)
        network.addCell(cell, record['name'] as GadgetId)
        return cell
    }
    
    toRecord(): any {
        return {
            name: (this.attributes['gadgetId'] as GadgetId) || 'gadget-unknown' as GadgetId,
            recordType: 'gadget',
            type: 'cell',
            primitiveName: (this.attributes['primitiveName'] as string) || 'unknown',
            ladder: (this.attributes['ladder'] as string | null) || null,
            outputPortId: this.outputPort.getId(),
            attributes: this.attributes
        }
    }
}

class Propagator {
    private boundInputs = new Set<number>()
    private unsubs: (() => void)[] = []
    public attributes: Record<string, unknown> = {}
    
    constructor(
        private inputPorts: Port<JsonValue>[],
        private computeFn: (...args: JsonValue[]) => JsonValue,
        private outputPort: Port<JsonValue>,
        attributes: Record<string, unknown> = {}
    ) {
        this.attributes = attributes
        inputPorts.forEach((port, index) => {
            const unsub = port.subscribe(value => this.onInput(index, value))
            this.unsubs.push(unsub)
        })
    }
    
    private onInput(index: number, value: JsonValue): void {
        if (value !== undefined && value !== null) {
            this.boundInputs.add(index)
            if (this.boundInputs.size === this.inputPorts.length) {
                const args = this.inputPorts.map(port => port.getValue()).filter((v): v is JsonValue => v !== undefined)
                this.outputPort.setValue(this.computeFn(...args))
            }
        }
    }
    
    getInputPorts(): Port<JsonValue>[] { return [...this.inputPorts] }
    getOutputPort(): Port<JsonValue> { return this.outputPort }
    
    destroy(): void {
        this.unsubs.forEach(unsub => unsub())
        this.unsubs = []
        this.boundInputs.clear()
    }
    
    // Serialization
    static fromRecord(record: any, network: Network): Propagator {
        const primitiveFn = record.primitiveName
        const computeFn = network.getPropagatorFunction(primitiveFn)
        if (!computeFn) {
            throw new Error(`Unknown primitive function: ${primitiveFn}`)
        }
        
        const inputPorts = record.inputPortIds.map((id: PortId) => 
            network.getPort(id) || new Port(id, { direction: 'input', gadget: record.name }))
        const outputPort = network.getPort(record.outputPortId) || 
                          new Port(record.outputPortId, { direction: 'output', gadget: record.name })
        
        const propagator = new Propagator(inputPorts, computeFn, outputPort, record.attributes)
        network.addPropagator(propagator, record.name)
        return propagator
    }
    
    toRecord(): any {
        return {
            name: (this.attributes['gadgetId'] as GadgetId) || 'gadget-unknown' as GadgetId,
            recordType: 'gadget',
            type: 'function',
            primitiveName: (this.attributes['primitiveName'] as string) || 'unknown',
            ladder: (this.attributes['ladder'] as string | null) || null,
            inputPortIds: this.inputPorts.map(p => p.getId()),
            outputPortId: this.outputPort.getId(),
            attributes: this.attributes
        }
    }
}

// Factory functions - work with objects, create ports automatically
function createCell<T extends JsonValue>(
    mergeFn: (current: T | undefined, incoming: T) => T,
    outputPortId: PortId,
    attributes: Record<string, unknown> = {}
): Cell<T> {
    const outputPort = new Port<T>(outputPortId, { ...attributes, direction: 'output' })
    return new Cell(mergeFn, outputPort, attributes)
}

function createPropagator(
    inputPortIds: PortId[],
    computeFn: (...args: JsonValue[]) => JsonValue,
    outputPortId: PortId,
    attributes: Record<string, unknown> = {}
): Propagator {
    const inputPorts = inputPortIds.map(id => new Port(id, { ...attributes, direction: 'input' }))
    const outputPort = new Port(outputPortId, { ...attributes, direction: 'output' })
    return new Propagator(inputPorts, computeFn, outputPort, attributes)
}

// Common factories - now just need port IDs
function createAdder(inputPortIds: [PortId, PortId], outputPortId: PortId, attributes: Record<string, unknown> = {}): Propagator {
    return createPropagator(inputPortIds, (a: JsonValue, b: JsonValue) => {
        if (typeof a === 'number' && typeof b === 'number') {
            return a + b
        }
        return 0
    }, outputPortId, { 
        ...attributes, 
        primitiveName: 'add',
        type: 'function'
    })
}

function createMaxCell(outputPortId: PortId, attributes: Record<string, unknown> = {}): Cell<JsonValue> {
    return createCell((current: JsonValue | undefined, incoming: JsonValue) => {
        if (typeof current === 'number' && typeof incoming === 'number') {
            return current === undefined ? incoming : Math.max(current, incoming)
        }
        return incoming
    }, outputPortId, {
        ...attributes,
        primitiveName: 'max',
        type: 'cell'
    })
}

// Example usage - working with objects directly
console.log('=== Testing Object-Based System with Function Registry ===')

// Create a simple network
const network = new Network({ name: 'test-network' })

// Register custom functions if needed
network.registerPropagatorFunction('customAdd', (a: JsonValue, b: JsonValue) => {
    if (typeof a === 'number' && typeof b === 'number') {
        return a + b + 1 // Custom behavior
    }
    return 0
})

const maxCell = createMaxCell('port-result' as PortId, { description: 'Max accumulator' })
const adder = createAdder(['port-a' as PortId, 'port-b' as PortId], 'port-sum' as PortId, { description: 'Addition function' })

network.addCell(maxCell, 'gadget-max' as GadgetId)
network.addPropagator(adder, 'gadget-adder' as GadgetId)

// Test the network - working with ports directly
const externalInput = new Port<JsonValue>('external' as PortId, { direction: 'input', type: 'number' })
network.addPort(externalInput)

// Connect objects directly - no ID lookup needed
maxCell.connectInput(externalInput)
const firstInputPort = adder.getInputPorts()[0]
if (firstInputPort) {
    network.connect(externalInput, firstInputPort)
}

externalInput.setValue(5)
console.log('Max after 5:', maxCell.getOutputPort().getValue())

// Serialize to record format
const networkRecord = network.toRecord()
console.log('Serialized network:', JSON.stringify(networkRecord, null, 2))

// Deserialize back to object format
const reconstructedNetwork = Network.fromRecord(networkRecord)
console.log('Reconstructed network ports:', reconstructedNetwork.toRecord().ports.length)

// Test the reconstructed network
const newExternalInput = reconstructedNetwork.getPort('external' as PortId)
if (newExternalInput) {
    newExternalInput.setValue(10)
    const newMaxCell = Array.from(reconstructedNetwork['cells'].values())[0]
    if (newMaxCell) {
        console.log('Reconstructed max after 10:', newMaxCell.getOutputPort().getValue())
    }
}

// Cleanup
network.destroy()
reconstructedNetwork.destroy()

console.log('Object-based system with function registry test completed!')


