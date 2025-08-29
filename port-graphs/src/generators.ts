// Simple propagation network leveraging MAIC properties
import { PortId, JsonValue } from "./types"

class Port<T = JsonValue> {
    private value: T | undefined
    private listeners = new Set<(value: T) => void>()
    
    constructor(private portId: PortId) {}
    
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
}

class Cell<T = JsonValue> {
    private value: T | undefined
    private unsubs: (() => void)[] = []
    
    constructor(
        private mergeFn: (current: T | undefined, incoming: T) => T,
        private outputPort: Port<T>
    ) {}
    
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
}

class Propagator {
    private boundInputs = new Set<number>()
    private unsubs: (() => void)[] = []
    
    constructor(
        private inputPorts: Port<any>[],
        private computeFn: (...args: any[]) => any,
        private outputPort: Port<any>
    ) {
        inputPorts.forEach((port, index) => {
            const unsub = port.subscribe(value => this.onInput(index, value))
            this.unsubs.push(unsub)
        })
    }
    
    private onInput(index: number, value: any): void {
        if (value !== undefined) {
            this.boundInputs.add(index)
            if (this.boundInputs.size === this.inputPorts.length) {
                const args = this.inputPorts.map(port => port.getValue())
                this.outputPort.setValue(this.computeFn(...args))
            }
        }
    }
    
    getInputPorts(): Port<any>[] { return [...this.inputPorts] }
    getOutputPort(): Port<any> { return this.outputPort }
    
    destroy(): void {
        this.unsubs.forEach(unsub => unsub())
        this.unsubs = []
        this.boundInputs.clear()
    }
}

// Factory functions
function createCell<T>(mergeFn: (current: T | undefined, incoming: T) => T, outputPortId: PortId): Cell<T> {
    return new Cell(mergeFn, new Port<T>(outputPortId))
}

function createPropagator(inputPortIds: PortId[], computeFn: (...args: any[]) => any, outputPortId: PortId): Propagator {
    const inputPorts = inputPortIds.map(id => new Port(id))
    const outputPort = new Port(outputPortId)
    return new Propagator(inputPorts, computeFn, outputPort)
}

// Common factories
function createAdder(inputPortIds: [PortId, PortId], outputPortId: PortId): Propagator {
    return createPropagator(inputPortIds, (a: number, b: number) => a + b, outputPortId)
}

function createMaxCell(outputPortId: PortId): Cell<number> {
    return createCell((current: number | undefined, incoming: number) => 
        current === undefined ? incoming : Math.max(current, incoming), outputPortId)
}

// Example usage
console.log('=== Testing Streamlined System ===')

const maxCell = createMaxCell('port-result' as PortId)
const adder = createAdder(['port-a' as PortId, 'port-b' as PortId], 'port-sum' as PortId)

const externalInput = new Port<number>('external' as PortId)
const unsub = maxCell.connectInput(externalInput)

externalInput.setValue(5)
console.log('Max after 5:', maxCell.getOutputPort().getValue())

externalInput.setValue(8)
console.log('Max after 8:', maxCell.getOutputPort().getValue())

adder.getInputPorts()[0]?.setValue(10)
adder.getInputPorts()[1]?.setValue(20)
console.log('Sum:', adder.getOutputPort().getValue())

unsub()
maxCell.destroy()
adder.destroy()

console.log('Streamlined system test completed!')


