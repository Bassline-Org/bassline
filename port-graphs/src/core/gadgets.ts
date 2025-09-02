import { INetwork } from "./gadget-types";
import { initializeBassline, LoggingLevel, Network } from "./globals";
import { Term } from "./terms";

// Extract global functions and objects
initializeBassline();

const bl = globalThis.BASSLINE;
const { info } = bl;

export abstract class GraphNode {
    attributes: Record<string, Term> = {};
    networkId: string | null = null;

    constructor(public readonly id: string) {
        this.id = id;
        this.networkId = bl.network().id;
    }

    setNetworkId(networkId: string) {
        this.networkId = networkId;
    }

    addAttribute(name: string, value: Term) {
        this.attributes[name] = value;
    }

    removeAttribute(name: string) {
        delete this.attributes[name];
    }

    getAttribute(name: string) {
        return this.attributes[name];
    }

    hasAttribute(name: string) {
        return name in this.attributes;
    }
    getNetwork(): Network {
        if (!this.networkId) {
            throw new Error('Network ID not set');
        }
        const n = bl.NETWORKS[this.networkId];
        if (!n) {
            throw new Error(`Network ${this.networkId} not found`);
        }
        return n as Network;
    }
}

export class Connection extends GraphNode {
    constructor(id: string, public readonly source: [string, string], public readonly target: [string, string]) {
        super(id);
    }
}



// Base gadget interface
export interface GadgetInterface {
    inputs: Record<string, { name: string; value: Term; attributes: Record<string, Term> }>;
    outputs: Record<string, { name: string; value: Term; attributes: Record<string, Term> }>;
};

export abstract class Gadget extends GraphNode {
    // Instance interface that decorators populate
    INTERFACE: GadgetInterface = {
        inputs: {},
        outputs: {},
    };
    
    constructor(id: string, networkId: string = bl.network().id) {
        super(id);
        this.setNetworkId(networkId);
        this.getNetwork().gadgets[id] = this;
        
        // Call the port definition method
        this.definePorts();
    }

    // Override this method to define your ports
    protected definePorts(): void {
        // Default implementation does nothing
        // Subclasses should override this to call addInput() and addOutput()
    }

    // Add an input port
    protected addInput(name: string, defaultValue: Term = null): void {
        this.INTERFACE.inputs[name] = {
            name,
            value: defaultValue,
            attributes: {}
        };
        
        // Define getter/setter on this instance
        Object.defineProperty(this, name, {
            get() {
                return this.INTERFACE.inputs[name]!.value;
            },
            set(newValue: Term) {
                const oldValue = this.INTERFACE.inputs[name]!.value;
                if (oldValue === newValue) return;
                
                this.INTERFACE.inputs[name]!.value = newValue;
                bl.onPortValueChanged(this, { name, value: newValue });
                
                if (this.shouldActivate()) {
                    bl.schedule(() => this.compute());
                }
            },
            enumerable: true,
            configurable: true
        });
    }

    // Add an output port
    protected addOutput(name: string, defaultValue: Term = null): void {
        this.INTERFACE.outputs[name] = {
            name,
            value: defaultValue,
            attributes: {}
        };
        
        // Define getter/setter on this instance
        Object.defineProperty(this, name, {
            get() {
                return this.INTERFACE.outputs[name]!.value;
            },
            set(newValue: Term) {
                const oldValue = this.INTERFACE.outputs[name]!.value;
                if (oldValue === newValue) return;
                
                this.INTERFACE.outputs[name]!.value = newValue;
                bl.onPortValueChanged(this, { name, value: newValue });
                
                // Propagate to connected inputs
                for (const connection of this.getNetwork().getConnectionsFor(this.id, name)) {
                    const [targetGadgetId, targetPortName] = connection.target;
                    const targetGadget = this.getNetwork().gadgets[targetGadgetId];
                    if (targetGadget) {
                        bl.schedule(() => {
                            targetGadget[targetPortName] = newValue;
                        });
                    }
                }
            },
            enumerable: true,
            configurable: true
        });
    }

    // Default activation rule - run when all inputs are ready
    shouldActivate(): boolean {
        return this.allInputsReady();
    }

    // Check if all inputs are ready
    allInputsReady(): boolean {
        const inputs = Object.values(this.INTERFACE.inputs);
        if (inputs.length === 0) return false; // No inputs defined yet
        return inputs.every(input => input.value !== null && input.value !== undefined);
    }

    // Abstract method that subclasses must implement
    abstract compute(): void;
}

// Decorator to define a gadget type
export function defineGadget(name: string) {
    return function (constructor: typeof Gadget) {
        // Register the gadget class in global registry
        if (bl.REGISTRY) {
            bl.REGISTRY[name] = constructor;
        }
    };
}



@defineGadget('foog')
export class FooGadget extends Gadget {
    a: Term = 0;
    b: Term = 0;
    c: Term = 0;

    compute(): void {
        this.c = (this.a as number) + (this.b as number);
    }
}

