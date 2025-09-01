import { INetwork } from "./gadget-types";
import { Term } from "./terms";

const { NETWORKS, REGISTRY, HOOKS } = globalThis.BASSLINE;

// Base gadget interface
export interface GadgetInterface {
    inputs: Record<string, { name: string; value: Term; attributes: Record<string, Term> }>;
    outputs: Record<string, { name: string; value: Term; attributes: Record<string, Term> }>;
};

export abstract class Gadget {
    INTERFACE: GadgetInterface = {
        inputs: {},
        outputs: {},
    };
    
    constructor(public readonly id: string, public readonly networkId: string) {
        // Register with global network system
        if (NETWORKS?.[networkId]) {
            NETWORKS[networkId][id] = this;
        }
    }

    getNetwork(): INetwork {
        const network = NETWORKS?.[this.networkId];
        if (!network) {
            throw new Error(`Network ${this.networkId} not found`);
        }
        return network;
    }

    protected setInputValue(name: string, value: Term) {
        let currentValue = this.INTERFACE.inputs[name]?.value;
        if (currentValue === value) return;
        
        this.INTERFACE.inputs[name]!.value = value;

        if (HOOKS?.onPortValueChanged) {
            HOOKS.onPortValueChanged(this, { name, value });
        }

        if (this.shouldActivate() && value !== this.INTERFACE.inputs[name]?.value) {
            this.compute();
        }
    }

    protected setOutputValue(name: string, value: Term) {
        let currentValue = this.INTERFACE.outputs[name]?.value;
        if (currentValue === value) return;
        
        this.INTERFACE.outputs[name]!.value = value;

        if (HOOKS?.onPortValueChanged) {
            HOOKS.onPortValueChanged(this, { name, value });
        }

        this.getNetwork()
    }

    // Check if all inputs are ready
    allInputsReady(): boolean {
        return Object.values(this.INTERFACE.inputs).every(
            (input) => input.value !== null && input.value !== undefined
        );
    }

    // Default activation rule - run when all inputs are ready
    shouldActivate(): boolean {
        return this.allInputsReady();
    }

    // Abstract method that subclasses must implement
    abstract compute(): void;
}

// Decorator to define a gadget type
export function defineGadget(name: string) {
    return function (constructor: typeof Gadget) {
        // Register the gadget class in global registry
        if (REGISTRY) {
            REGISTRY[name] = constructor;
        }
    };
}

// Decorator for input ports
export function input(defaultValue: Term = null) {
    return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
        if (!target || !target.constructor) {
            console.warn('Input decorator called with invalid target:', target);
            return;
        }

        let value = defaultValue;
        
        Object.defineProperty(target, propertyKey, {
            get() {
                return value;
            },
            set(newValue: Term) {
                if (value === newValue) return;
                value = newValue;
                // Update the interface
                if (this.INTERFACE.inputs[propertyKey]) {
                    this.INTERFACE.inputs[propertyKey].value = newValue;
                }

                // Call the hook if it exists
                if (HOOKS?.onPortValueChanged) {
                    HOOKS.onPortValueChanged(this, { name: propertyKey, value: newValue });
                }

                // Trigger computation if activation policy is met
                if (this.shouldActivate() && newValue !== value) {
                    this.compute();
                }
            },
            enumerable: true,
            configurable: true
        });
    };
}

// Decorator for output ports
export function output(defaultValue: Term = null) {
    return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
        if (!target || !target.constructor) {
            console.warn('Output decorator called with invalid target:', target);
            return;
        }
        
        let value = defaultValue;
        
        Object.defineProperty(target, propertyKey, {
            get() {
                return value;
            },
            set(newValue: Term) {
                if (value === newValue) return;
                value = newValue;
                // Update the interface
                if (this.INTERFACE.outputs[propertyKey]) {
                    this.INTERFACE.outputs[propertyKey].value = newValue;
                }
                
                // Call the hook if it exists
                if (HOOKS?.onPortValueChanged) {
                    HOOKS.onPortValueChanged(this, { name: propertyKey, value: newValue });
                }
            },
            enumerable: true,
            configurable: true
        });
    };
}

// Factory function to create gadget instances
export function createGadget(gadgetName: string, id: string, networkId: string) {
    const GadgetClass = REGISTRY[gadgetName];
    if (!GadgetClass) {
        throw new Error(`Unknown gadget type: ${gadgetName}`);
    }
    return new (GadgetClass as any)(id, networkId);
}

// Get gadget interface
export function getGadgetInterface(gadgetName: string): GadgetInterface | undefined {
    const GadgetClass = REGISTRY[gadgetName];
    if (!GadgetClass) return undefined;
    
    // Create a temporary instance to get the interface
    const temp = new (GadgetClass as any)('temp', 'temp');
    return temp.INTERFACE;
}

// List all available gadget types
export function listGadgetTypes(): string[] {
    return Object.keys(REGISTRY || {});
}