// Simple propagation network leveraging MAIC properties
import { PortId, JsonValue, GadgetId, ConnectionId } from "./types"
import { defaultCellFunctions } from "./default-cell-functions"
import { defaultPropagatorFunctions } from "./default-propagator-functions"

// Network container class - manages objects, not IDs
class Network {
    private gadgets = new Map<GadgetId, Gadget>()
    private connections = new Map<ConnectionId, { source: Port<JsonValue>, target: Port<JsonValue> }>()
    private cellFunctionRegistry = new Map<string, (current: JsonValue | undefined, incoming: JsonValue) => JsonValue>()
    private propagatorFunctionRegistry = new Map<string, (...args: JsonValue[]) => JsonValue>()
    public attributes: Record<string, unknown> = {}
    
    constructor(
        attributes: Record<string, unknown> = {},
        cellFunctions: Array<{ name: string, fn: (current: JsonValue | undefined, incoming: JsonValue) => JsonValue }> = [],
        propagatorFunctions: Array<{ name: string, fn: (...args: JsonValue[]) => JsonValue }> = []
    ) {
        this.attributes = attributes
        this.loadDefaultFunctions(cellFunctions, propagatorFunctions)
    }
    
    private loadDefaultFunctions(
        cellFunctions: Array<{ name: string, fn: (current: JsonValue | undefined, incoming: JsonValue) => JsonValue }>,
        propagatorFunctions: Array<{ name: string, fn: (...args: JsonValue[]) => JsonValue }>
    ): void {
        // Load cell functions
        cellFunctions.forEach(({ name, fn }) => {
            this.registerCellFunction(name, fn)
        })
        
        // Load propagator functions
        propagatorFunctions.forEach(({ name, fn }) => {
            this.registerPropagatorFunction(name, fn)
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
    
    // Simple add method - no ID management needed
    add(gadget: Gadget): void {
        this.gadgets.set(gadget.id, gadget)
    }
    
    // Connect ports directly - no ID lookup needed
    connect(sourcePort: Port<JsonValue>, targetPort: Port<JsonValue>): void {
        const id = `connection-${sourcePort.id}-${targetPort.id}` as ConnectionId
        this.connections.set(id, { source: sourcePort, target: targetPort })
        sourcePort.connect(targetPort)
    }
    
    // Get all gadgets of a specific type
    getGadgets<T extends Gadget>(type: new (...args: any[]) => T): T[] {
        return Array.from(this.gadgets.values()).filter(g => g instanceof type) as T[]
    }
    
    // Helper to find ports across all gadgets
    findPort(portId: PortId): Port<JsonValue> | undefined {
        for (const gadget of this.gadgets.values()) {
            if (gadget.hasPort(portId)) {
                return gadget.getPort(portId)
            }
        }
        return undefined
    }
    
    // Serialization
    static fromRecord(
        record: Record<string, unknown>,
        cellFunctions: Array<{ name: string, fn: (current: JsonValue | undefined, incoming: JsonValue) => JsonValue }> = [],
        propagatorFunctions: Array<{ name: string, fn: (...args: JsonValue[]) => JsonValue }> = []
    ): Network {
        const network = new Network(record['attributes'] as Record<string, unknown>, cellFunctions, propagatorFunctions)
        
        // Create gadgets first (they'll create their own ports)
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
            const sourcePort = network.findPort(connRecord['source'] as PortId)
            const targetPort = network.findPort(connRecord['target'] as PortId)
            if (sourcePort && targetPort) {
                network.connect(sourcePort, targetPort)
            }
        })
        
        return network
    }
    
    // Convenience method to create a Network with default functions
    static withDefaults(attributes: Record<string, unknown> = {}): Network {
        return new Network(attributes, defaultCellFunctions, defaultPropagatorFunctions)
    }
    
    toRecord(): Record<string, unknown> {
        return {
            gadgets: Array.from(this.gadgets.values()).map(gadget => gadget.toRecord()),
            connections: Array.from(this.connections.entries()).map(([id, conn]) => ({
                name: id,
                recordType: 'connection' as const,
                source: conn.source.id,
                target: conn.target.id
            })),
            attributes: this.attributes
        }
    }
    
    destroy(): void {
        this.gadgets.forEach(gadget => gadget.destroy())
        this.gadgets.clear()
        this.connections.clear()
    }
}

// Base class for all gadgets
abstract class Gadget {
    public readonly id: GadgetId
    public attributes: Record<string, unknown> = {}
    
    constructor(name: string, attributes: Record<string, unknown> = {}) {
        this.id = `gadget-${name}` as GadgetId
        this.attributes = { ...attributes, name }
    }
    
    abstract hasPort(portId: PortId): boolean
    abstract getPort(portId: PortId): Port<JsonValue> | undefined
    abstract destroy(): void
    abstract toRecord(): Record<string, unknown>
}

class Port<T = JsonValue> {
    public readonly id: PortId
    private value: T | undefined
    private listeners = new Set<(value: T) => void>()
    public attributes: Record<string, unknown> = {}
    
    constructor(name: string, attributes: Record<string, unknown> = {}) {
        this.id = `port-${name}` as PortId
        this.attributes = { ...attributes, name }
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
    
    // Serialization
    static fromRecord(record: Record<string, unknown>): Port<JsonValue> {
        const port = new Port(record['name'] as string, record['attributes'] as Record<string, unknown>)
        if (record['currentValue'] !== null) {
            port.setValue(record['currentValue'] as JsonValue)
        }
        return port
    }
    
    toRecord(): Record<string, unknown> {
        return {
            name: this.attributes['name'] as string,
            recordType: 'port',
            portName: this.attributes['name'] as string,
            type: (this.attributes['type'] as string) || 'any',
            direction: (this.attributes['direction'] as 'input' | 'output' | 'bidirectional') || 'bidirectional',
            position: (this.attributes['position'] as 'top' | 'bottom' | 'left' | 'right') || 'top',
            gadget: this.attributes['gadget'] as GadgetId | null || null,
            currentValue: this.value as JsonValue,
            attributes: this.attributes
        }
    }
}

class Cell<T = JsonValue> extends Gadget {
    private value: T | undefined
    private unsubs: (() => void)[] = []
    private outputPort: Port<JsonValue>
    
    constructor(
        name: string,
        private mergeFn: (current: T | undefined, incoming: T) => T,
        initialValue?: T,
        attributes: Record<string, unknown> = {}
    ) {
        super(name, { ...attributes, type: 'cell' })
        this.outputPort = new Port<JsonValue>(`${name}-output`, { 
            ...attributes, 
            direction: 'output', 
            gadget: this.id,
            type: 'cell'
        })
        if (initialValue !== undefined) {
            this.value = initialValue
            this.outputPort.setValue(initialValue as JsonValue)
        }
    }
    
    accept(incoming: T): void {
        const newValue = this.mergeFn(this.value, incoming)
        if (newValue !== this.value) {
            this.value = newValue
            this.outputPort.setValue(newValue as JsonValue)
        }
    }
    
    connectInput(inputPort: Port<T>): () => void {
        const unsub = inputPort.subscribe(value => this.accept(value))
        this.unsubs.push(unsub)
        return unsub
    }
    
    getOutputPort(): Port<JsonValue> { return this.outputPort }
    
    hasPort(portId: PortId): boolean {
        return this.outputPort.id === portId
    }
    
    getPort(portId: PortId): Port<JsonValue> | undefined {
        return this.hasPort(portId) ? this.outputPort : undefined
    }
    
    destroy(): void {
        this.unsubs.forEach(unsub => unsub())
        this.unsubs = []
        this.value = undefined
        this.outputPort.destroy()
    }
    
    // Serialization
    static fromRecord(record: Record<string, unknown>, network: Network): Cell<JsonValue> {
        const primitiveFn = record['primitiveName'] as string
        const mergeFn = network.getCellFunction(primitiveFn)
        if (!mergeFn) {
            throw new Error(`Unknown primitive function: ${primitiveFn}`)
        }
        
        const cell = new Cell(
            record['name'] as string,
            mergeFn,
            record['initialValue'] as JsonValue,
            record['attributes'] as Record<string, unknown>
        )
        network.add(cell)
        return cell
    }
    
    toRecord(): Record<string, unknown> {
        return {
            name: this.attributes['name'] as string,
            recordType: 'gadget',
            type: 'cell',
            primitiveName: (this.attributes['primitiveName'] as string) || 'unknown',
            ladder: (this.attributes['ladder'] as string | null) || null,
            initialValue: this.value,
            attributes: this.attributes
        }
    }
}

class Propagator extends Gadget {
    private boundInputs = new Set<number>()
    private unsubs: (() => void)[] = []
    private inputPorts: Port<JsonValue>[] = []
    private outputPort: Port<JsonValue>
    
    constructor(
        name: string,
        private computeFn: (...args: JsonValue[]) => JsonValue,
        inputCount: number,
        attributes: Record<string, unknown> = {}
    ) {
        super(name, { ...attributes, type: 'function' })
        
        // Create input ports
        for (let i = 0; i < inputCount; i++) {
            this.inputPorts.push(new Port(`${name}-input-${i}`, { 
                ...attributes, 
                direction: 'input', 
                gadget: this.id,
                type: 'function'
            }))
        }
        
        // Create output port
        this.outputPort = new Port(`${name}-output`, { 
            ...attributes, 
            direction: 'output', 
            gadget: this.id,
            type: 'function'
        })
        
        // Subscribe to input changes
        this.inputPorts.forEach((port, index) => {
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
    
    hasPort(portId: PortId): boolean {
        return this.inputPorts.some(p => p.id === portId) || this.outputPort.id === portId
    }
    
    getPort(portId: PortId): Port<JsonValue> | undefined {
        const inputPort = this.inputPorts.find(p => p.id === portId)
        if (inputPort) return inputPort
        if (this.outputPort.id === portId) return this.outputPort
        return undefined
    }
    
    destroy(): void {
        this.unsubs.forEach(unsub => unsub())
        this.unsubs = []
        this.boundInputs.clear()
        this.inputPorts.forEach(port => port.destroy())
        this.outputPort.destroy()
    }
    
    // Serialization
    static fromRecord(record: Record<string, unknown>, network: Network): Propagator {
        const primitiveFn = record['primitiveName'] as string
        const computeFn = network.getPropagatorFunction(primitiveFn)
        if (!computeFn) {
            throw new Error(`Unknown primitive function: ${primitiveFn}`)
        }
        
        const inputCount = (record['inputCount'] as number) || 2
        const propagator = new Propagator(
            record['name'] as string,
            computeFn,
            inputCount,
            record['attributes'] as Record<string, unknown>
        )
        network.add(propagator)
        return propagator
    }
    
    toRecord(): Record<string, unknown> {
        return {
            name: this.attributes['name'] as string,
            recordType: 'gadget',
            type: 'function',
            primitiveName: (this.attributes['primitiveName'] as string) || 'unknown',
            ladder: (this.attributes['ladder'] as string | null) || null,
            inputCount: this.inputPorts.length,
            attributes: this.attributes
        }
    }
}

// Clean factory functions - just name + optional initial value
function createMaxCell(name: string, initialValue?: number): Cell<JsonValue> {
    return new Cell(name, (current: JsonValue | undefined, incoming: JsonValue) => {
        if (typeof current === 'number' && typeof incoming === 'number') {
            return current === undefined ? incoming : Math.max(current, incoming)
        }
        return incoming
    }, initialValue, { primitiveName: 'max' })
}

function createUnionCell(name: string, initialValue: JsonValue[] = []): Cell<JsonValue> {
    return new Cell(name, (current: JsonValue | undefined, incoming: JsonValue) => {
        if (Array.isArray(current) && Array.isArray(incoming)) {
            return [...new Set([...current, ...incoming])]
        }
        return incoming
    }, initialValue, { primitiveName: 'union' })
}

function createAdder(name: string): Propagator {
    return new Propagator(name, (a: JsonValue, b: JsonValue) => {
        if (typeof a === 'number' && typeof b === 'number') {
            return a + b
        }
        return 0
    }, 2, { primitiveName: 'add' })
}

function createMultiplier(name: string): Propagator {
    return new Propagator(name, (a: JsonValue, b: JsonValue) => {
        if (typeof a === 'number' && typeof b === 'number') {
            return a * b
        }
        return 0
    }, 2, { primitiveName: 'multiply' })
}

// Example usage - much cleaner and more fluent
console.log('=== Testing Clean, Fluent System ===')

// Create a simple network with default functions
const network = Network.withDefaults({ name: 'test-network' })

// Create gadgets - just name + optional initial value
const maxCell = createMaxCell('max-accumulator', 0)
const unionCell = createUnionCell('set-union', ['initial'])
const adder = createAdder('addition-function')
const multiplier = createMultiplier('multiplication-function')

// Add them to the network - no ID management needed
network.add(maxCell)
network.add(unionCell)
network.add(adder)
network.add(multiplier)

// Create external inputs
const externalInput = new Port<JsonValue>('external-input', { direction: 'input', type: 'number' })
const arrayInput = new Port<JsonValue>('array-input', { direction: 'input', type: 'array' })

// Connect everything - working with ports directly
maxCell.connectInput(externalInput)
unionCell.connectInput(arrayInput)

// Connect to propagator inputs
const firstInputPort = adder.getInputPorts()[0]
const secondInputPort = adder.getInputPorts()[1]
if (firstInputPort && secondInputPort) {
    network.connect(externalInput, firstInputPort)
    network.connect(externalInput, secondInputPort)
}

// Test propagation
externalInput.setValue(5)
console.log('Max after 5:', maxCell.getOutputPort().getValue())

externalInput.setValue(8)
console.log('Max after 8:', maxCell.getOutputPort().getValue())

externalInput.setValue(3)
console.log('Max after 3 (should still be 8):', maxCell.getOutputPort().getValue())

// Test array union
arrayInput.setValue(['a', 'b'])
console.log('Union after [a,b]:', unionCell.getOutputPort().getValue())

arrayInput.setValue(['b', 'c'])
console.log('Union after [b,c]:', unionCell.getOutputPort().getValue())

// Serialize to record format
const networkRecord = network.toRecord()
console.log('Serialized network:', JSON.stringify(networkRecord, null, 2))

// Deserialize back to object format
const reconstructedNetwork = Network.fromRecord(networkRecord, defaultCellFunctions, defaultPropagatorFunctions)
console.log('Reconstructed network gadgets:', reconstructedNetwork.getGadgets(Cell).length + reconstructedNetwork.getGadgets(Propagator).length)

// Test the reconstructed network
const newExternalInput = reconstructedNetwork.findPort('port-external-input' as PortId)
if (newExternalInput) {
    newExternalInput.setValue(10)
    const newMaxCell = reconstructedNetwork.getGadgets(Cell)[0]
    if (newMaxCell) {
        console.log('Reconstructed max after 10:', newMaxCell.getOutputPort().getValue())
    }
}

// Cleanup
network.destroy()
reconstructedNetwork.destroy()

console.log('Clean, fluent system test completed!')


