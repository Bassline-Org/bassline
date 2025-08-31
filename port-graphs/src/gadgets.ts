import type { Attributes, PortDirection, ConnectionPath } from './gadget-types'
import { Nothing, Term, Opaque } from './terms'

export type InputHandler = (self: Gadget, value: Term) => void

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
        this.value = value

        if (this.direction === 'output') {
            // Output ports propagate to all connected input ports
            this.propagate(value)
        } else {
            // Input ports trigger gadget handler
            this.gadget.receive(this.name, value)
        }
    }

    // Propagate value to all connected ports
    private propagate(value: Term) {
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

    // Check if this port can accept more connections
    canAcceptConnection(): boolean {
        if (this.connectionLimit === null) {
            return true // Unlimited
        }
        return this.connections.size < this.connectionLimit
    }

    // Get the connection limit for this port
    getConnectionLimit(): number | null {
        return this.connectionLimit
    }
}

export class Gadget {
    private ports = new Map<string, Port>()
    private inputHandlers = new Map<string, InputHandler>()

    constructor(
        public readonly id: string,
        public readonly network: Network,
        public readonly attributes: Attributes = {}
    ) {
        // All gadgets get a control port
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
        if (Array.isArray(term) && term.length >= 2) {
            const [command, ...args] = term

            switch (command) {
                case 'add-input-port': {
                    const [name, value, attributes] = args as [string, Term, Attributes?]
                    const port = new Port(name, 'input', this, this.network, value || Nothing, attributes || {})
                    this.ports.set(name, port)
                    if (value && value !== Nothing) {
                        port.accept(value)
                    }
                    break
                }
                case 'add-output-port': {
                    const [name, attributes] = args as [string, Attributes?]
                    const port = new Port(name, 'output', this, this.network, Nothing, attributes || {})
                    this.ports.set(name, port)
                    break
                }
                case 'set-input-handler': {
                    const [name, handlerOpaque] = args as [string, Opaque<InputHandler>]
                    const [_, handler] = handlerOpaque
                    this.inputHandlers.set(name, handler)
                    break
                }
                case 'set-connection-limit': {
                    const [portName, limit] = args as [string, number | null]
                    const port = this.ports.get(portName)
                    if (port) {
                        port.setConnectionLimit(limit)
                    }
                    break
                }
                case 'connect': {
                    const [sourcePort, targetPath] = args as [string, ConnectionPath]
                    const source = this.ports.get(sourcePort)
                    if (source) {
                        source.connectTo(targetPath)
                    }
                    break
                }
            }
        }
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

    // Get all ports
    getPorts(): Port[] {
        return Array.from(this.ports.values())
    }
}

export class Cell extends Gadget {
    constructor(id: string, network: Network, attributes: Attributes = {}, mergeFn: (current: Term, incoming: Term) => Term) {
        super(id, network, attributes)

        // Set up the cell via control terms
        this.receive('control', ['add-input-port', 'value-in'])
        this.receive('control', ['add-output-port', 'value-out'])
        this.receive('control', ['set-input-handler', 'value-in', ['opaque', (self: Gadget, value: Term) => {
            const currentValue = self.getPort('value-out')?.value || Nothing
            const result = mergeFn(currentValue, value)
            self.emit('value-out', result)
        }]])
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

    // Get all gadgets
    getGadgets(): Gadget[] {
        return Array.from(this.gadgets.values())
    }
}