import { Gadget } from "./gadgets";
import { ConnectionPath } from "./gadget-types";

export enum LoggingLevel {
    DEBUG = 3,
    INFO = 2,
    WARN = 1,
    ERROR = 0,
    NONE = -1,
}

var CURRENT_NETWORK_ID: string | undefined;
var CURRENT_GADGET_ID: string | undefined;
var NETWORKS: Record<string, any> = {};
var REGISTRY: Record<string, any> = {};
var JOBS: (() => void)[] = [];
var LOGGING_LEVEL = LoggingLevel.DEBUG;

export function assertBassline() {
    if (!globalThis.BASSLINE) {
        throw new Error('Bassline is not initialized');
    }
}

export function bassline() {
    if (!globalThis.BASSLINE) {
        initializeBassline();
    }
    return globalThis.BASSLINE;
}

// ================================
// Logging
// ================================
function info(message: string) {
    if (globalThis.BASSLINE.LOGGING_LEVEL >= LoggingLevel.INFO) {
        console.log(message);
    }
}

function debug(message: string) {
    if (globalThis.BASSLINE.LOGGING_LEVEL >= LoggingLevel.DEBUG) {
        console.log(message);
    }
}

function warn(message: string) {
    if (globalThis.BASSLINE.LOGGING_LEVEL >= LoggingLevel.WARN) {
        console.warn(message);
    }
}

function error(message: string) {
    if (globalThis.BASSLINE.LOGGING_LEVEL >= LoggingLevel.ERROR) {
        console.error(message);
    }
}


function network() {
    if (!CURRENT_NETWORK_ID) {
        throw new Error('No network selected');
    }
    return globalThis.BASSLINE.NETWORKS[CURRENT_NETWORK_ID];
}

function gadget() {
    if (!CURRENT_GADGET_ID) {
        throw new Error('No gadget selected');
    }
    const net = network();
    if (!net) {
        throw new Error('No network selected');
    }
    const gad = net.gadgets[CURRENT_GADGET_ID];
    if (!gad) {
        throw new Error(`Gadget ${CURRENT_GADGET_ID} not found`);
    }
    return gad;
}

function enterNetwork(id: string, body: () => void) {
    info(`Entering network ${id}`);
    const old = CURRENT_NETWORK_ID;
    CURRENT_NETWORK_ID = id;
    try {
        body();
    } catch (e) {
        CURRENT_NETWORK_ID = old;
        throw e;
    }
    CURRENT_NETWORK_ID = old;
    info(`Exiting network ${id}`);
}

function enterGadget(id: string, body: () => void) {
    info(`Entering gadget ${id}`);
    const old = CURRENT_GADGET_ID;
    CURRENT_GADGET_ID = id;
    try {
        body();
    } catch (e) {
        CURRENT_GADGET_ID = old;
        throw e;
    }
    CURRENT_GADGET_ID = old;
    info(`Exiting gadget ${id}`);
}

// ================================
// Hooks
// ================================
function onGadgetCreated(id: string) {
    globalThis.BASSLINE.info(`Gadget created ${id}`);
}
function onGadgetDestroyed(id: string) {
    globalThis.BASSLINE.info(`Gadget destroyed ${id}`);
}
function onGadgetStarted(id: string) {
    globalThis.BASSLINE.info(`Gadget started ${id}`);
}
function onGadgetFinished(id: string) {
    globalThis.BASSLINE.info(`Gadget finished ${id}`);
}
function onConnectionCreated(id: string) {
    globalThis.BASSLINE.info(`Connection created ${id}`);
}
function onConnectionRemoved(id: string) {
    globalThis.BASSLINE.info(`Connection removed ${id}`);
}
function onNetworkCreated(id: string) {
    globalThis.BASSLINE.info(`Network created ${id}`);
}
function onNetworkRemoved(id: string) {
    globalThis.BASSLINE.info(`Network removed ${id}`);
}
function onPortAdded(id: string) {
    globalThis.BASSLINE.info(`Port added ${id}`);
}
function onPortRemoved(id: string) {
    globalThis.BASSLINE.info(`Port removed ${id}`)
}
function onPortValueChanged(gadget: Gadget, port: string) {
    globalThis.BASSLINE.info(`Port value changed ${gadget.id} ${port}`);
}
function onJobScheduled(job: () => void) {
    globalThis.BASSLINE.info(`Job scheduled`);
}
function onStep() {
    globalThis.BASSLINE.info(`Step`);
}

// ================================
// Actions
// ================================
function registerGadget(name: string, gadget: typeof Gadget) {
    if (globalThis.BASSLINE.REGISTRY[name]) {
        warn(`Gadget type ${name} already registered, overwriting`);
    }
    globalThis.BASSLINE.REGISTRY[name] = gadget;
}

function createNetwork(id: string) {
    if (globalThis.BASSLINE.NETWORKS[id]) {
        throw new Error(`Network ${id} already exists`);
    }
    globalThis.BASSLINE.NETWORKS[id] = new Network(id);
    globalThis.BASSLINE.onNetworkCreated(id);
}

export function createGadget<T extends Gadget>(id: string, kind: string): T {
    const gadgetClass = globalThis.BASSLINE.REGISTRY[kind];
    if (!gadgetClass) {
        throw new Error(`Gadget class ${kind} not found`);
    }
    let g = new gadgetClass(id) as T;
    globalThis.BASSLINE.onGadgetCreated(id);
    return g;
}

function connect(source: [string, string], target: [string, string]) {
    const n = globalThis.BASSLINE.network();
    n.connect(source, target);
    globalThis.BASSLINE.onConnectionCreated(source[0]);
}

function schedule(job: () => void) {
    globalThis.BASSLINE.JOBS.push(job);
    globalThis.BASSLINE.onJobScheduled(job);
}

function step(): number {
    globalThis.BASSLINE.onStep();
    throw new Error('Not implemented');
}

export class Network {
    gadgets: Record<string, Gadget> = {};
    connections: Record<string, Record<string, ConnectionPath[]>> = {};

    constructor(public readonly id: string) {
        globalThis.BASSLINE.NETWORKS[id] = this;
    }

    connect(source: [string, string], target: [string, string]): void {
        const sourceGadget = this.gadgets[source[0]];
        const targetGadget = this.gadgets[target[0]];
        if (!sourceGadget || !targetGadget) {
            throw new Error(`Source or target not found`);
        }

        let fromSource = this.connections[source[0]];
        if (!fromSource) {
            this.connections[source[0]] = {};
            fromSource = this.connections[source[0]];
        }

        let fromPort = fromSource![source[1]];
        if (!fromPort) {
            fromSource![source[1]] = [];
            fromPort = fromSource![source[1]];
        }

        fromPort!.push([target[0], target[1]]);
        this.connections[source[0]] = fromSource!;
    }

    getOutputsFor(gadgetId: string, port: string): ConnectionPath[] {
        const n = globalThis.BASSLINE.NETWORKS[gadgetId];
        if (!n) {
            throw new Error(`Network ${gadgetId} not found`);
        }
        const connections = n.connections[gadgetId]![port];
        if (!connections) {
            return [];
        }
        return connections;
    }
}

export function initializeBassline() {
    if (globalThis.BASSLINE) {
        return;
    }

    globalThis.BASSLINE = {
        ...globalThis.BASSLINE,
        NETWORKS,
        REGISTRY,
        JOBS,
        LOGGING_LEVEL,
        // Core functions
        network,
        gadget,
        enterNetwork,
        enterGadget,
        registerGadget,
        createNetwork,
        createGadget,
        connect,
        schedule,
        step,
        // Hooks
        onGadgetCreated,
        onGadgetDestroyed,
        onGadgetStarted,
        onGadgetFinished,
        onConnectionCreated,
        onConnectionRemoved,
        onNetworkCreated,
        onNetworkRemoved,
        onPortAdded,
        onPortRemoved,
        onPortValueChanged,
        onJobScheduled,
        onStep,
        // Logging
        info,
        debug,
        warn,
        error,
    }
}