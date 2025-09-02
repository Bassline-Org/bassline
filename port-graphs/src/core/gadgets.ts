import { INetwork, PortDirection } from "./gadget-types";
import { initializeBassline, LoggingLevel, Network } from "./globals";
import { Term } from "./terms";

// Extract global functions and objects
initializeBassline();

const bl = globalThis.BASSLINE;
const { info } = bl;

export abstract class GraphNode {
    attributes: Record<string, Term> = {};

    constructor(public readonly id: string, public readonly networkId: string = bl.network().id) { }

    addAttributes(attributes: Record<string, Term>): void {
        this.attributes = { ...this.attributes, ...attributes };
    }

    hasAttribute(name: string) {
        return name in this.attributes;
    }

    getNetwork(): Network {
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

export type DecoratorOptions = {
    defaultValue?: Term;
    validate?: (value: Term) => boolean;
}

export function input({defaultValue, validate}: DecoratorOptions = { defaultValue: null, validate: _term => true }) {
    return function (target: any, propertyKey: string) {
        const valueSymbol = Symbol(`__${propertyKey}`);
        const interfaceInitialized = Symbol(`__${propertyKey}_initialized`);

        Object.defineProperty(target, propertyKey, {
            get() {
                // Lazy initialization of value
                if (!(valueSymbol in this)) {
                    if (defaultValue && validate && !validate(defaultValue)) {
                        throw new Error(`Invalid value for ${propertyKey}: ${String(defaultValue)}`);
                    }
                    this[valueSymbol] = defaultValue;
                }
                return this[valueSymbol];
            },

            set(newValue: Term) {
                // ALWAYS ensure INTERFACE is set up (even on first call)
                if (!this[interfaceInitialized]) {
                    // First time setup
                    if (validate && !validate(newValue)) {
                        throw new Error(`Invalid value for ${propertyKey}: ${String(newValue)}`);
                    }
                    if (!this.inputs[propertyKey]) {
                        this.inputs[propertyKey] = {
                            name: propertyKey,
                            value: newValue,
                            attributes: {}
                        };
                    }
                    this[interfaceInitialized] = true;
                }

                // Get old value (might be undefined on first set)
                const oldValue = this[valueSymbol];

                if (oldValue === newValue) {
                    return;
                }

                if (validate && !validate(newValue)) {
                    throw new Error(`Invalid value for ${propertyKey}: ${String(newValue)}`);
                }

                // Store new value
                this[valueSymbol] = newValue;
                this.inputs[propertyKey].value = newValue;


                // Update INTERFACE
                this.inputs[propertyKey].value = newValue;

                // Only trigger updates if value actually changed
                bl.onPortValueChanged(this, { name: propertyKey, value: newValue });

                this.maybeRun();
            },

            enumerable: true,
            configurable: true
        });
    };
}

export function output({defaultValue, validate}: DecoratorOptions = { defaultValue: null, validate: _term => true }) {
    return function (target: any, propertyKey: string) {
        const valueSymbol = Symbol(`__output_${propertyKey}`);
        const interfaceInitialized = Symbol(`__output_${propertyKey}_initialized`);

        Object.defineProperty(target, propertyKey, {
            get() {
                // Lazy initialization of value
                if (!(valueSymbol in this)) {
                    this[valueSymbol] = defaultValue;
                }
                if (validate && !validate(this[valueSymbol])) {
                    throw new Error(`Invalid value for ${propertyKey}: ${this[valueSymbol]}`);
                }
                return this[valueSymbol];
            },

            set(newValue: Term) {
                // ALWAYS ensure INTERFACE is set up (even on first call)
                if (!this[interfaceInitialized]) {
                    // First time setup
                    if (!this.outputs[propertyKey]) {
                        if (validate && !validate(newValue)) {
                            throw new Error(`Invalid value for ${propertyKey}: ${String(newValue)}`);
                        }
                        this.outputs[propertyKey] = {
                            name: propertyKey,
                            value: newValue,
                            attributes: {}
                        };
                    }
                    this[interfaceInitialized] = true;
                }

                // Get old value (might be undefined on first set)
                const oldValue = this[valueSymbol];

                if (oldValue === newValue) {
                    return;
                }

                if (validate && !validate(newValue)) {
                    throw new Error(`Invalid value for ${propertyKey}: ${String(newValue)}`);
                }

                // Store new value
                this[valueSymbol] = newValue;
                this.outputs[propertyKey].value = newValue;

                // Update INTERFACE
                this.outputs[propertyKey].value = newValue;

                // Only trigger updates if value actually changed
                bl.onPortValueChanged(this, { name: propertyKey, value: newValue });

                this.maybeEmit(propertyKey);
            },

            enumerable: true,
            configurable: true
        });
    };
}

export type InputPort = { name: string; direction: 'input'; value: Term; attributes: Record<string, Term> };
export type OutputPort = { name: string; direction: 'output'; value: Term; attributes: Record<string, Term> };

export abstract class Gadget extends GraphNode {
    inputs: Record<string, InputPort> = {};
    outputs: Record<string, OutputPort> = {};

    constructor(id: string, networkId: string = bl.network().id) {
        super(id, networkId);
        // Add the gadget to the network
        this.getNetwork().gadgets[id] = this;
    }

    // Default activation rule - run when all inputs are ready
    shouldRun(inputs: Term[] = this.inputValues()): boolean {
        return inputs.every(input => input !== null && input !== undefined);
    }

    inputValues() { return Object.values(this.inputs).map(input => input.value) }

    maybeRun(): void {
        console.log('maybeRun', this.shouldRun());
        if (this.shouldRun()) {
            this.compute();
        }
    }

    maybeEmit(port: string): void {
        console.log('maybeEmit', port);
        if (this.outputs[port]?.value) {
            const allConnections = this.getNetwork().connections[this.id];
            if (!allConnections) return;
            const outputPortConnections = allConnections[port];
            if (!outputPortConnections) return;
            for (const [targetGadgetId, targetPort] of outputPortConnections) {
                const targetGadget = this.getNetwork().gadgets[targetGadgetId];
                if (!targetGadget) return;
                targetGadget[targetPort] = this.outputs[port]!.value;
            }
        }
    }

    // Check if all inputs are ready
    allInputsReady(): boolean {
        console.log('allInputsReady', this.inputs);
        const inputs = Object.values(this.inputs);
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

export abstract class Cell extends Gadget {
    @input() in: Term = this.defaults().in;
    @output() out: Term = this.defaults().out;

    abstract merge(old: Term, incoming: Term): Term;

    defaults(): { in: Term, out: Term } {
        return { in: null, out: null };
    }

    compute() {
        const merged = this.merge(this.out, this.in);
        if(merged !== this.out) {
            this.out = merged;
        }
    }
}

@defineGadget('or')
export class Or extends Cell {
    override defaults() {
        return { in: null, out: null };
    }
    merge(old: Term, incoming: Term): Term {
        return old || incoming;
    }
}

@defineGadget('adder')
export class FooGadget extends Gadget {
    @input() a!: number;
    @input() b!: number;
    @output() c!: number;

    override shouldRun(inputs: Term[]) {
        return super.shouldRun(inputs)
        && inputs.every(input => typeof input === 'number');
    }

    compute(): void {
        this.c = (this.a as number) + (this.b as number);
    }
}

@defineGadget('max')
export class Max extends Cell {
    override defaults() {
        return { in: -Infinity, out: -Infinity };
    }
    merge(old: Term, incoming: Term): Term {
        return Math.max(old as number, incoming as number);
    }
}

@defineGadget('min')
export class Min extends Cell {
    override defaults() {
        return { in: Infinity, out: Infinity };
    }
    merge(old: Term, incoming: Term): Term {
        return Math.min(old as number, incoming as number);
    }
}


const net = bl.createNetwork('test');
const other = bl.createNetwork('other');

bl.enterNetwork('test', () => {
    const a = bl.createGadget('a', 'max');
    console.log('Network', bl.network().id);

    //console.log('gadgets', bl.network().gadgets);

    bl.enterNetwork('other', () => {
        const b = bl.createGadget('b', 'max');
        console.log('Network', bl.network().id);

        //console.log('gadgets', bl.network().gadgets);
    });
});

//console.log('gadgets', bl.network().gadgets);

// const net = bl.createNetwork('test');
// bl.enterNetwork('test', () => {
//     const a = bl.createGadget('a', 'max');
//     const b = bl.createGadget('b', 'max');
//     const c = bl.createGadget('c', 'max');
//     const adder = bl.createGadget('adder', 'adder');

//     bl.connect([a, 'out'], [adder, 'a']);
//     bl.connect([b, 'out'], [adder, 'b']);
//     bl.connect([adder, 'c'], [c, 'in']);
// })