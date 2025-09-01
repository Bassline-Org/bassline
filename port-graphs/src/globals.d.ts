// Global registry for gadget types
declare global {
    var GadgetGlobals: {
        GADGET_REGISTRY: { [name: string]: any };
        GADGET_METADATA: { [name: string]: any };
        NAMESPACES: { [name: string]: { [id: string]: any } };
        __GADGET_GLOBALS_INITIALIZED: boolean;
    }
    
    var GadgetConfig: {
        DEBUG_LOGGING: boolean;
        INITIALIZATION_MODE: boolean;
        COMPUTATION_LOGGING: boolean;
        [key: string]: any;
    }
}

export {}
