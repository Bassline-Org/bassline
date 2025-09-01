import { ConnectionPath, INetwork } from "../core/gadget-types";
import { Term } from "../core/terms";
import { Gadget, GadgetMetadata } from "../core/gadgets";

// Base global registry for gadget types
declare global {
    namespace BASSLINE {
        function createGadget(id: string, kind: string): void;
        function createNetwork(id: string): void;
        function connect(source: [string, string], target: [string, string]): void;
        function registerGadget(name: string, gadget: typeof Gadget): void;

        function schedule(job: () => void): void;
        function step(): number;

        // All networks in the system
        var NETWORKS: { [name: string]: INetwork }; // networkId -> INetwork
        var REGISTRY: { [name: string]: typeof Gadget }; // gadgetType -> constructor
        var JOBS: (() => void)[];

        // Dynamic bindings
        namespace dynamic {
            var CURRENT_NETWORK_ID: string | undefined;
            var CURRENT_GADGET_ID: string | undefined;

            function network(): Network; // Will be extended by specific targets
            function gadget(): typeof Gadget; // Will be extended by specific targets

            function enterNetwork(id: string, body: () => void): void;
            function enterGadget(id: string, body: () => void): void;
        }

        // Hooks for the system. Allows for integration with other systems or debugging.
        namespace HOOKS {
            // Gadget lifecycle hooks
            function onGadgetCreated(gadget: Gadget): void;
            function onGadgetDestroyed(gadget: Gadget): void;            
            function onGadgetStarted(gadget: Gadget): void;
            function onGadgetFinished(gadget: Gadget): void;

            // Connection Lifecycle hooks
            function onConnectionCreated(connection: any): void; // Will be extended by specific targets
            function onConnectionRemoved(connection: any): void; // Will be extended by specific targets

            // Network lifecycle hooks
            function onNetworkCreated(network: any): void; // Will be extended by specific targets
            function onNetworkRemoved(network: any): void; // Will be extended by specific targets

            // Port lifecycle hooks
            function onPortAdded(port: any): void; // Will be extended by specific targets
            function onPortRemoved(port: any): void; // Will be extended by specific targets

            // Port value hooks
            function onPortValueChanged(gadget: Gadget, port: any): void; // Will be extended by specific targets
        }

        namespace CONFIG {
            var LOGGING_LEVEL: 'debug' | 'info' | 'warn' | 'error' | 'none';
        }
    }
}

export {}