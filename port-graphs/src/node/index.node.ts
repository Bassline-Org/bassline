/// <reference path="./globals.node.d.ts" />

// Node.js-specific exports and initialization
export { Gadget, defineGadget, input, output, cellInput, createGadget, getGadgetMetadata, listGadgetTypes } from '../core/gadgets'
export { Term } from '../core/terms'
export { P } from '../core/combinators'
export { SetInterfaceSchema, SetInputHandlerSchema, SetConnectionLimitSchema, ConnectSchema, ConnectAndSyncSchema, BatchSchema, type GadgetInterface } from '../core/schemas'
export type { 
    Attributes, 
    PortDirection, 
    ConnectionPath,
    GadgetType,
    GadgetTerm,
    PortTerm,
    ConnectionTerm
} from '../core/gadget-types'

// Node.js-specific initialization
export function initializeNode() {
    // Initialize node-specific globals
    if (typeof globalThis.BASSLINE === 'undefined') {
        globalThis.BASSLINE = {} as any;
    }
    
    // Initialize node namespace
    if (!globalThis.BASSLINE.NODE) {
        globalThis.BASSLINE.NODE = {
            saveNetworkToFile: (networkId: string, filepath: string) => {
                // Node-specific file operations
                console.log(`Saving network ${networkId} to ${filepath}`);
                // TODO: Implement actual file saving
            },
            
            loadNetworkFromFile: (filepath: string) => {
                // Node-specific file operations
                console.log(`Loading network from ${filepath}`);
                // TODO: Implement actual file loading
                return null;
            },
            
            spawnWorker: (script: string) => {
                // Node-specific worker spawning
                console.log(`Spawning worker with script: ${script}`);
                // TODO: Implement actual worker spawning
                return null;
            },
            
            terminateWorker: (worker: any) => {
                // Node-specific worker termination
                console.log('Terminating worker');
                // TODO: Implement actual worker termination
            },
            
            FS_HOOKS: {
                onNetworkSaved: (networkId: string, filepath: string) => {
                    console.log(`Network ${networkId} saved to ${filepath}`);
                },
                onNetworkLoaded: (network: any, filepath: string) => {
                    console.log(`Network loaded from ${filepath}`);
                }
            }
        };
    }
    
    // Wire up node hooks to core hooks
    if (globalThis.BASSLINE.HOOKS) {
        const originalOnNetworkCreated = globalThis.BASSLINE.HOOKS.onNetworkCreated;
        globalThis.BASSLINE.HOOKS.onNetworkCreated = (network: any) => {
            // Call original hook
            if (originalOnNetworkCreated) {
                originalOnNetworkCreated(network);
            }
            // Call node-specific hook
            globalThis.BASSLINE.NODE.FS_HOOKS.onNetworkLoaded(network, 'memory');
        };
    }
    
    console.log('🎸 Bassline Node.js initialized!');
}

// Auto-initialize in node environment
if (typeof process !== 'undefined') {
    initializeNode();
}
