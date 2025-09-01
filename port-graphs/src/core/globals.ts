import { Gadget } from "./gadgets";
import { ConnectionPath } from "./gadget-types";

export function assertBassline() {
    if (!globalThis.BASSLINE) {
        throw new Error('Bassline is not initialized');
    }
}

export const initializeBassline = () => {
    if (globalThis.BASSLINE) {
        return;
    }
    const b: any = {};

    b.NETWORKS = {}
    b.REGISTRY = {}
    b.HOOKS = {
        onGadgetCreated: () => {},
        onGadgetDestroyed: () => {},
        onGadgetStarted: () => {},
        onGadgetFinished: () => {},
        onConnectionCreated: () => {},
        onConnectionRemoved: () => {},
        onNetworkCreated: () => {},
        onNetworkRemoved: () => {},
        onPortAdded: () => {},
        onPortRemoved: () => {},
        onPortValueChanged: () => {},
    }
    b.JOBS = [];
    b.registerGadget = (name: string, gadget: typeof Gadget) => {
        b.REGISTRY[name] = gadget;
    }
    b.createNetwork = (id: string) => {
        b.NETWORKS[id] = new Network(id);
    }
    b.createGadget = (id: string, kind: string) => {
        throw new Error('Not implemented');
    }
    b.connect = (source: [string, string], target: [string, string]) => {
        throw new Error('Not implemented');
    }
    b.schedule = (job: () => void) => {
        b.JOBS.push(job);
    }
    b.step = () => {
        throw new Error('Not implemented');
    }
    b.CONFIG = {
        LOGGING_LEVEL: 'debug',
    }
    
    globalThis.BASSLINE = b;
};

export function bassline() {
    assertBassline();
    return globalThis.BASSLINE;
}

export function initializeDynamicBindings() {
    const b = bassline();
    var CURRENT_NETWORK_ID: string | undefined;
    var CURRENT_GADGET_ID: string | undefined;

    function network() {
        if (!CURRENT_NETWORK_ID) {
            throw new Error('No network selected');
        }
        return b.NETWORKS[CURRENT_NETWORK_ID];
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
        const old = CURRENT_NETWORK_ID;
        CURRENT_NETWORK_ID = id;
        try {
            body();
        } catch (e) {
            CURRENT_NETWORK_ID = old;
            throw e;
        }
        CURRENT_NETWORK_ID = old;
    }

    function enterGadget(id: string, body: () => void) {
        const old = CURRENT_GADGET_ID;
        CURRENT_GADGET_ID = id;
        try {
            body();
        } catch (e) {
            CURRENT_GADGET_ID = old;
            throw e;
        }
        CURRENT_GADGET_ID = old;
    }

    b.dynamic = {
        CURRENT_NETWORK_ID,
        CURRENT_GADGET_ID,
        network,
        gadget,
        enterNetwork,
        enterGadget,
    }
}

export function createGadget(id: string, kind: string) {
    assertBassline();
    const { REGISTRY } = bassline();
    const gadgetClass = REGISTRY[kind];
    if (!gadgetClass) {
        throw new Error(`Gadget class ${kind} not found`);
    }
    return new gadgetClass(id);
}

export class Network {
    gadgets: Record<string, typeof Gadget> = {};
    connections: Record<string, [string, ConnectionPath][]> = {};

    constructor(public readonly id: string) {
        assertBassline();
        bassline().NETWORKS[id] = this;
    }
}

initializeBassline();
initializeDynamicBindings();

const { createNetwork } = bassline();
const { network, enterNetwork } = bassline().dynamic;

const net = createNetwork('foo');
enterNetwork('foo', () => {
    console.log('entered network');
    console.log(network());
});

const otherNet = createNetwork('bar');
enterNetwork('bar', () => {
    console.log('entered network bar');
    console.log(network());
    enterNetwork('foo', () => {
        console.log('entered network foo from bar');
        console.log(network());
    });
});
