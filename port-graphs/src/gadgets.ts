import { Term } from "./terms";
import { ConnectionPath } from "./gadget-types";

// Gadget metadata interface
export interface GadgetMetadata {
    inputs: Record<string, any>;
    outputs: Record<string, any>;
    hasActivation: boolean;
    isCell: boolean;
}

// Extended constructor interface to include decorator metadata
interface GadgetConstructor {
    new(id: string, namespace: string): Gadget;
    _inputProperties?: Record<string, Term>;
    _outputProperties?: Record<string, Term>;
    _activationMethod?: string;
    _isCell?: boolean;
}

// Base gadget interface
export interface GadgetInterface {
    inputs: Record<string, { name: string; value: Term; attributes: Record<string, Term> }>;
    outputs: Record<string, { name: string; value: Term; attributes: Record<string, Term> }>;
};

// Base gadget class
export abstract class Gadget {
    INTERFACE: GadgetInterface = {
        inputs: {},
        outputs: {},
    };
    namespace: any;
    connections: Map<string, ConnectionPath[]> = new Map();

    constructor(public readonly id: string, namespace: string) {
        // Ensure namespace exists
        if (!globalThis.GadgetGlobals.NAMESPACES[namespace]) {
            globalThis.GadgetGlobals.NAMESPACES[namespace] = {};
        }
        
        const ns = globalThis.GadgetGlobals.NAMESPACES[namespace];
        if (ns[id]) {
            throw new Error(`Gadget ${id} already exists in namespace ${namespace}`);
        }
        this.namespace = ns;
        this.namespace[id] = this as any;
        
        this.initializePorts();
        
        if (globalThis.GadgetConfig.DEBUG_LOGGING) {
            console.log(`🔧 Gadget ${id} initialized in namespace ${namespace}`);
        }
    }

    // Initialize ports based on decorator metadata
    private initializePorts() {
        const constructor = this.constructor as GadgetConstructor;
        
        // Initialize inputs with getter/setter
        if (constructor._inputProperties) {
            Object.entries(constructor._inputProperties).forEach(([name, defaultValue]) => {
                const propertyName = String(name);
                this.INTERFACE.inputs[propertyName] = {
                    name: propertyName,
                    value: defaultValue,
                    attributes: {},
                };
                
                // Create getter/setter for input property
                let inputValue = defaultValue;
                const self = this;
                Object.defineProperty(this, propertyName, {
                    get() {
                        return inputValue;
                    },
                    set(newValue: Term) {
                        inputValue = newValue;
                        // Update the interface
                        if (self.INTERFACE.inputs[propertyName]) {
                            self.INTERFACE.inputs[propertyName].value = newValue;
                        }
                        
                        if (globalThis.GadgetConfig.DEBUG_LOGGING) {
                            console.log(`📥 Input set to ${String(newValue)}`);
                        }
                        
                        // Trigger computation if activation policy is met
                        // But only if this isn't the initial value being set during initialization
                        if (self.shouldActivate() && newValue !== defaultValue) {
                            if (globalThis.GadgetConfig.COMPUTATION_LOGGING) {
                                console.log(`⚡ Triggering computation for ${self.id}`);
                            }
                            self.compute();
                        }
                    },
                    enumerable: true,
                    configurable: true
                });
            });
        }

        // Initialize outputs with getter/setter
        if (constructor._outputProperties) {
            Object.entries(constructor._outputProperties).forEach(([name, defaultValue]) => {
                this.INTERFACE.outputs[name] = {
                    name,
                    value: defaultValue,
                    attributes: {},
                };
                
                // Create getter/setter for output property
                let outputValue = defaultValue;
                Object.defineProperty(this, name, {
                    get() {
                        return outputValue;
                    },
                    set(newValue: Term) {
                        outputValue = newValue;
                        // Update the interface
                        this.INTERFACE.outputs[name].value = newValue;
                        // Propagate to connected gadgets
                        this.propagateOutput(name, newValue);
                    },
                    enumerable: true,
                    configurable: true
                });
            });
        }
    }

    // Propagate output value to connected gadgets
    // @ts-ignore - TypeScript incorrectly thinks this is unused
    private propagateOutput(outputName: string, value: Term) {
        const connections = this.connections.get(outputName);
        if (!connections) {
            return; // No connections for this output
        }
        
        for (const [targetGadgetId, targetInputName] of connections) {
            // Find the target gadget in the same namespace
            const namespace = this.namespace;
            const targetGadget = namespace[targetGadgetId];
            if (!targetGadget) {
                console.warn(`Target gadget ${targetGadgetId} not found in namespace`);
                continue;
            }
            (targetGadget as any)[targetInputName] = value;
        }
    }

    // Connect an output to another gadget's input
    connectOutput(outputName: string, targetGadgetId: string, targetInputName: string) {
        if (!this.connections.has(outputName)) {
            this.connections.set(outputName, []);
        }
        this.connections.get(outputName)!.push([targetGadgetId, targetInputName]);
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
        if(! globalThis.GadgetGlobals.__GADGET_GLOBALS_INITIALIZED) {
            throw new Error('GadgetGlobals not initialized');
        }
        // Register the gadget class
        globalThis.GadgetGlobals.GADGET_REGISTRY[name] = constructor;

        // Store metadata about the gadget
        const typedConstructor = constructor as GadgetConstructor;
        globalThis.GadgetGlobals.GADGET_METADATA[name] = {
            inputs: typedConstructor._inputProperties || {},
            outputs: typedConstructor._outputProperties || {},
            hasActivation: !!typedConstructor._activationMethod,
            isCell: !!typedConstructor._isCell,
        };
    };
}

// Decorator for input ports
export function input(defaultValue: Term = null) {
    return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
        // For old experimental decorators, target is the prototype
        if (!target || !target.constructor) {
            console.warn('Input decorator called with invalid target:', target);
            return;
        }
        
        if (!target.constructor._inputProperties) {
            target.constructor._inputProperties = {};
        }
        target.constructor._inputProperties[propertyKey] = defaultValue;
    };
}

// Decorator for cell input ports (allows multiple connections)
export function cellInput(defaultValue: Term = null) {
    return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
        if (!target || !target.constructor) {
            console.warn('CellInput decorator called with invalid target:', target);
            return;
        }
        
        if (!target.constructor._inputProperties) {
            target.constructor._inputProperties = {};
        }
        target.constructor._inputProperties[propertyKey] = defaultValue;
        target.constructor._isCell = true;
    };
}

// Decorator for output ports
export function output(defaultValue: Term = null) {
    return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
        if (!target || !target.constructor) {
            console.warn('Output decorator called with invalid target:', target);
            return;
        }
        
        if (!target.constructor._outputProperties) {
            target.constructor._outputProperties = {};
        }
        target.constructor._outputProperties[propertyKey] = defaultValue;
    };
}

// Factory function to create gadget instances
export function createGadget(gadgetName: string, id: string, namespace: string) {
    const GadgetClass = globalThis.GadgetGlobals.GADGET_REGISTRY[gadgetName];
    if (!GadgetClass) {
        throw new Error(`Unknown gadget type: ${gadgetName}`);
    }
    return new GadgetClass(id, namespace) as any;
}

// Get gadget metadata
export function getGadgetMetadata(gadgetName: string): GadgetMetadata | undefined {
    return globalThis.GadgetGlobals.GADGET_METADATA[gadgetName];
}

// List all available gadget types
export function listGadgetTypes(): string[] {
    return Object.keys(globalThis.GadgetGlobals.GADGET_REGISTRY || {});
}


