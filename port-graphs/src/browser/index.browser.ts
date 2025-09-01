/// <reference path="./globals.browser.d.ts" />
// Browser-specific exports and initialization
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

// Browser-specific initialization
export function initializeBrowser() {
    // Initialize browser-specific globals
    if (typeof globalThis.BASSLINE === 'undefined') {
        globalThis.BASSLINE = {} as any;
    }
    
    // Initialize browser namespace
    if (!globalThis.BASSLINE.BROWSER) {
        globalThis.BASSLINE.BROWSER = {
            emitUIEvent: (eventType: string, data: any) => {
                if (typeof document !== 'undefined') {
                    document.dispatchEvent(new CustomEvent(`bassline-${eventType}`, {
                        detail: data,
                        bubbles: true
                    }));
                }
            },
            
            gadgetElements: new Map<string, HTMLElement>(),
            networkElements: new Map<string, HTMLElement>(),
            
            UI_HOOKS: {
                onNetworkCreated: (network: any) => {
                    globalThis.BASSLINE.BROWSER.emitUIEvent('network-created', { network });
                },
                onCellValueChanged: (cellId: string, value: any, source: string) => {
                    globalThis.BASSLINE.BROWSER.emitUIEvent('cell-value-changed', { cellId, value, source });
                },
                onGadgetConnected: (fromId: string, toId: string, port: string) => {
                    globalThis.BASSLINE.BROWSER.emitUIEvent('gadget-connected', { fromId, toId, port });
                },
                onGadgetDisconnected: (fromId: string, toId: string, port: string) => {
                    globalThis.BASSLINE.BROWSER.emitUIEvent('gadget-disconnected', { fromId, toId, port });
                }
            }
        };
    }
    
    // Wire up browser hooks to core hooks
    if (globalThis.BASSLINE.HOOKS) {
        const originalOnNetworkCreated = globalThis.BASSLINE.HOOKS.onNetworkCreated;
        globalThis.BASSLINE.HOOKS.onNetworkCreated = (network: any) => {
            // Call original hook
            if (originalOnNetworkCreated) {
                originalOnNetworkCreated(network);
            }
            // Call browser-specific hook
            globalThis.BASSLINE.BROWSER.UI_HOOKS.onNetworkCreated(network);
        };
    }
    
    console.log('🎸 Bassline Browser initialized!');
}

// Auto-initialize in browser environment
if (typeof window !== 'undefined') {
    initializeBrowser();
}
