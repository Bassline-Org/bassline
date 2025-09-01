// Core TMS System Exports

export function initialize() {
    if (globalThis.GadgetGlobals?.__GADGET_GLOBALS_INITIALIZED) {
        return;
    }
    
    // Initialize global configuration
    globalThis.GadgetConfig = {
        DEBUG_LOGGING: false,
        INITIALIZATION_MODE: false,
        COMPUTATION_LOGGING: false,
    };
    
    globalThis.GadgetGlobals = {
        GADGET_REGISTRY: {},
        GADGET_METADATA: {},
        NAMESPACES: {},
        __GADGET_GLOBALS_INITIALIZED: true,
    }
}

export { Gadget, defineGadget, input, output, cellInput, createGadget, getGadgetMetadata, listGadgetTypes } from './gadgets'
export { Term } from './terms'
export { P } from './combinators'
export { SetInterfaceSchema, SetInputHandlerSchema, SetConnectionLimitSchema, ConnectSchema, ConnectAndSyncSchema, BatchSchema, type GadgetInterface } from './schemas'
export type { 
    Attributes, 
    PortDirection, 
    ConnectionPath,
    GadgetType,
    GadgetTerm,
    PortTerm,
    ConnectionTerm
} from './gadget-types'
