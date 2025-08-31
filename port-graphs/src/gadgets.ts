import type { Attributes, PortDirection, ConnectionPath } from './gadget-types'
import { Nothing, Term } from './terms'

// Re-export Nothing for convenience
export { Nothing }

export type InputHandler = (self: Gadget, value: Term) => void

// ================================
// Command Predicates
// ================================

// Import our combinators
import { P } from './combinators'
// Define predicates for each command type
const isSetInterface = P.startsWith(P.eq('setInterface'), P.hasMinLength(2))
const isSetInputHandler = P.startsWith(P.eq('set-input-handler'), P.hasMinLength(3))
const isSetConnectionLimit = P.startsWith(P.eq('set-connection-limit'), P.hasLength(3))
const isConnect = P.startsWith(P.eq('connect'), P.hasLength(3))
const isConnectAndSync = P.startsWith(P.eq('connect-and-sync'), P.hasLength(3))
const isBatch = P.startsWith(P.eq('batch'), P.hasMinLength(2))

// Ports belong to the network and handle their own propagation
export class Port {
    private connections: Set<ConnectionPath> = new Set() // Connection paths like [gadgetId, portName]
    private connectionLimit: number | null = null // null = unlimited, number = max connections

    constructor(
        public readonly name: string,
        public readonly direction: PortDirection,
        public readonly gadget: Gadget,
        public readonly network: Network,
        public value: Term = Nothing,
        public readonly attributes: Attributes = {}
    ) {}

    // Set connection limit via terms
    setConnectionLimit(limit: number | null) {
        this.connectionLimit = limit
    }

    // Connect this port to another port by path
    connectTo(targetPath: ConnectionPath) {
        // Check connection limit if set
        if (this.connectionLimit !== null && this.connections.size >= this.connectionLimit) {
            throw new Error(`Port '${this.name}' has reached its connection limit of ${this.connectionLimit}`)
        }
        
        this.connections.add(targetPath)
    }

    // Accept a value (triggers propagation)
    accept(value: Term) {
        // Only propagate if the value actually changed
        if (this.value !== value) {
            this.value = value
            if (this.direction === 'output') {
                // Output ports propagate to all connected input ports
                this.propagate(value)
            } else {
                // Input ports trigger gadget handler directly
                const handler = this.gadget.getInputHandler(this.name)
                if (handler) {
                    handler(this.gadget, value)
                }
            }
        }
    }

    // Propagate value to all connected ports
    public propagate(value: Term) {
        const outputs = new Map<string, string[]>()
        for (const connection of this.connections) {
            const [targetGadgetId, targetPortName] = connection
            if (!outputs.has(targetGadgetId)) {
                outputs.set(targetGadgetId, [])
            }
            outputs.get(targetGadgetId)!.push(targetPortName)
        }

        for (const [gadget, ports] of outputs) {
            const targetGadget = this.network.getGadget(gadget)
            if (targetGadget) {
                for (const portName of ports) {
                    const targetPort = targetGadget.getPort(portName)
                    if (targetPort) {
                        targetPort.accept(value)
                    }
                }
            }
        }
    }

    // Get connection paths
    getConnections(): ConnectionPath[] {
        return Array.from(this.connections)
    }
}

export class Gadget {
    protected ports = new Map<string, Port>()
    protected inputHandlers = new Map<string, InputHandler>()

    constructor(
        public readonly id: string,
        public readonly network: Network,
        public readonly attributes: Attributes = {}
    ) {
        // All gadgets get a control port
        this.network.addGadget(this)
        this.ports.set('control', new Port('control', 'input', this, network))
    }

    // Process terms to build ports and set handlers
    receive(portName: string, term: Term) {
        if (portName === 'control') {
            this.processControl(term)
        } else {
            const port = this.ports.get(portName)
            if (!port) {
                throw new Error(`Unknown port: ${portName}`)
            }
            port.accept(term)
        }
    }

    private processControl(term: Term) {
        if (!P.isArray(term) || !P.hasMinLength(2)(term)) {
            throw new Error(`Invalid control term: ${JSON.stringify(term)}`)
        }
        
        const [command, ...args] = term as [string, ...Term[]]
        
        // Use guards to process commands
        if (isSetInterface(term)) {
            const [gadgetInterface] = args as [{
                inputs: Array<{ name: string; value?: Term; attributes?: Attributes }>
                outputs: Array<{ name: string; attributes?: Attributes }>
            }]
            
            // Create all input ports
            for (const input of gadgetInterface.inputs) {
                const port = new Port(input.name, 'input', this, this.network, input.value || Nothing, input.attributes || {})
                this.ports.set(input.name, port)
            }
            
            // Create all output ports
            for (const output of gadgetInterface.outputs) {
                const port = new Port(output.name, 'output', this, this.network, Nothing, output.attributes || {})
                this.ports.set(output.name, port)
            }
            return
        }
        
        if (isSetInputHandler(term)) {
            const [name, handlerOpaque] = args as [string, [string, InputHandler]]
            const [_, handler] = handlerOpaque
            this.inputHandlers.set(name, handler)
            return
        }
        
        if (isSetConnectionLimit(term)) {
            const [portName, limit] = args as [string, number | null]
            const port = this.ports.get(portName)
            if (port) {
                port.setConnectionLimit(limit)
            }
            return
        }
        
        if (isConnect(term)) {
            const [sourcePort, targetPath] = args as [string, ConnectionPath]
            const source = this.ports.get(sourcePort)
            if (source) {
                source.connectTo(targetPath)
            }
            return
        }
        
        if (isConnectAndSync(term)) {
            const [sourcePort, targetPath] = args as [string, ConnectionPath]
            const source = this.ports.get(sourcePort)
            if (source) {
                // Connect the ports
                source.connectTo(targetPath)
                
                // Forward current value if it's not Nothing
                if (source.value !== Nothing) {
                    source.propagate(source.value)
                }
            }
            return
        }
        
        if (isBatch(term)) {
            const commands = args[0] as Term[]
            for (const command of commands) {
                this.processControl(command)
            }
            return
        }
        
        throw new Error(`Unknown control command: ${command}`)
    }

    // Emit to output port (triggers automatic propagation)
    emit(portName: string, value: Term) {
        const port = this.ports.get(portName)
        if (!port) {
            throw new Error(`Unknown port: ${portName}`)
        }
        if (port.direction !== 'output') {
            throw new Error(`Cannot emit to input port: ${portName}`)
        }
        port.accept(value)
    }

    // Get port
    getPort(portName: string): Port | undefined {
        return this.ports.get(portName)
    }

    // Get input handler for a port
    getInputHandler(portName: string): InputHandler | undefined {
        return this.inputHandlers.get(portName)
    }
}

export class Cell extends Gadget {
    constructor(id: string, network: Network, attributes: Attributes = {}, mergeFn: (current: Term, incoming: Term) => Term) {
        super(id, network, attributes)

        // Set up the cell interface and handler
        this.receive('control', ['setInterface', {
            inputs: [{ name: 'value-in' }],
            outputs: [{ name: 'value-out' }]
        }])
        
        this.receive('control', ['set-input-handler', 'value-in', ['opaque', (self: Gadget, value: Term) => {
            const currentValue = self.getPort('value-out')?.value || Nothing
            const result = mergeFn(currentValue, value)
            self.emit('value-out', result)
        }]])
    }
}

export class FunctionGadget extends Gadget {
    private inputValues = new Map<string, Term>()
    private fn: (inputs: Record<string, Term>) => Term

    constructor(
        id: string, 
        network: Network, 
        config: {
            inputs: string[]
            outputs: string[]
            fn: (inputs: Record<string, Term>) => Term
        }
    ) {
        super(id, network)
        this.fn = config.fn

        // Set up the gadget interface
        this.receive('control', ['setInterface', {
            inputs: config.inputs.map(name => ({ name })),
            outputs: config.outputs.map(name => ({ name }))
        }])

        // Set up auto-trigger handler for each input
        for (const name of config.inputs) {
            this.receive('control', ['set-input-handler', name, ['opaque', (_self: Gadget, value: Term) => {
                this.handleInputUpdate(name, value)
            }]])
        }
    }

    private handleInputUpdate(portName: string, value: Term) {
        // Store the input value
        this.inputValues.set(portName, value)
        
        // Check if all inputs have values
        if (this.allInputsReady()) {
            // Execute the function with all input values
            const inputs = Object.fromEntries(this.inputValues)
            const result = this.fn(inputs)
            
            // Emit result to first output port (assuming single output for now)
            const outputPortNames = this.getOutputPortNames()
            if (outputPortNames.length > 0) {
                const firstOutput = outputPortNames[0]
                if (firstOutput) {
                    this.emit(firstOutput, result)
                }
            }
        }
    }

    private allInputsReady(): boolean {
        // Check if all input ports have values
        const inputPortNames = this.getInputPortNames()
        for (const name of inputPortNames) {
            if (!this.inputValues.has(name)) {
                return false
            }
        }
        return true
    }

    private getInputPortNames(): string[] {
        return Array.from(this.ports.entries())
            .filter(([_, port]) => port.direction === 'input')
            .map(([name, _]) => name)
            .filter(name => name !== 'control')
    }

    private getOutputPortNames(): string[] {
        return Array.from(this.ports.entries())
            .filter(([_, port]) => port.direction === 'output')
            .map(([name, _]) => name)
    }
}

export class BehaviorCell extends Cell {
    private behaviors = new Map<string, Term[]>()

    constructor(id: string, network: Network, attributes: Attributes = {}) {
        super(id, network, attributes, (_current, incoming) => incoming)
        
        // Set up behavior management interface
        this.receive('control', ['setInterface', {
            inputs: [
                { name: 'define-behavior' },
                { name: 'load-behavior' }
            ],
            outputs: [
                { name: 'behavior-defined' },
                { name: 'behavior-loaded' }
            ]
        }])
        
        // Set up handlers
        this.receive('control', ['set-input-handler', 'define-behavior', ['opaque', (_self: Gadget, value: Term) => {
            this.defineBehavior(value)
        }]])
        
        this.receive('control', ['set-input-handler', 'load-behavior', ['opaque', (_self: Gadget, value: Term) => {
            this.loadBehavior(value)
        }]])
    }

    private defineBehavior(behaviorSpec: Term) {
        if (Array.isArray(behaviorSpec) && behaviorSpec.length >= 2) {
            const [behaviorName, commands] = behaviorSpec as [string, Term[]]
            this.behaviors.set(behaviorName, commands)
            this.emit('behavior-defined', behaviorName)
            console.log(`📝 Behavior '${behaviorName}' defined with ${commands.length} commands`)
        }
    }

    private loadBehavior(loadSpec: Term) {
        if (Array.isArray(loadSpec) && loadSpec.length >= 2) {
            const [behaviorName, targetGadgetId] = loadSpec as [string, string]
            const behavior = this.behaviors.get(behaviorName)
            
            if (behavior) {
                const targetGadget = this.network.getGadget(targetGadgetId)
                if (targetGadget) {
                    // Load the behavior into the target gadget
                    targetGadget.receive('control', ['batch', ...behavior])
                    this.emit('behavior-loaded', [behaviorName, targetGadgetId])
                    console.log(`🚀 Behavior '${behaviorName}' loaded into '${targetGadgetId}'`)
                } else {
                    console.log(`❌ Target gadget '${targetGadgetId}' not found`)
                }
            } else {
                console.log(`❌ Behavior '${behaviorName}' not found`)
            }
        }
    }

    getBehavior(behaviorName: string): Term[] | undefined {
        return this.behaviors.get(behaviorName)
    }

    listBehaviors(): string[] {
        return Array.from(this.behaviors.keys())
    }
}

// Network just manages gadgets and provides lookup
export class Network {
    private gadgets = new Map<string, Gadget>()

    constructor(public readonly id: string) { }

    addGadget(gadget: Gadget) {
        this.gadgets.set(gadget.id, gadget)
    }

    // Get gadget by ID
    getGadget(id: string): Gadget | undefined {
        return this.gadgets.get(id)
    }
}