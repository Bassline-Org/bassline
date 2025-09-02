import { ConnectionPath, INetwork } from "../core/gadget-types";
import { Term } from "../core/terms";
import { Gadget } from "../core/gadgets";

// Base global registry for gadget types
declare global {
    namespace BASSLINE {
        function createGadget<T extends Gadget>(id: string, kind: string): T;
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
        var CURRENT_NETWORK_ID: string | undefined;
        var CURRENT_GADGET_ID: string | undefined;

        function network(): Network; // Will be extended by specific targets
        function gadget(): Gadget; // Will be extended by specific targets

        function enterNetwork(id: string, body: () => void): void;
        function enterGadget(id: string, body: () => void): void;

        // Logging
        function info(message: string): void;
        function debug(message: string): void;
        function warn(message: string): void;
        function error(message: string): void;

        // Hooks for the system. Allows for integration with other systems or debugging.
        // Gadget lifecycle hooks
        function onGadgetCreated(id: string): void;
        function onGadgetDestroyed(id: string): void;
        function onGadgetStarted(id: string): void;
        function onGadgetFinished(id: string): void;

        // Connection Lifecycle hooks
        function onConnectionCreated(connection: id): void; // Will be extended by specific targets
        function onConnectionRemoved(connection: id): void; // Will be extended by specific targets

        // Network lifecycle hooks
        function onNetworkCreated(network: id): void; // Will be extended by specific targets
        function onNetworkRemoved(network: id): void; // Will be extended by specific targets

        // Port lifecycle hooks
        function onPortAdded(port: id): void; // Will be extended by specific targets
        function onPortRemoved(port: id): void; // Will be extended by specific targets

        // Port value hooks
        function onPortValueChanged(gadget: Gadget, port: id): void; // Will be extended by specific targets

        // Job lifecycle hooks
        function onJobScheduled(job: () => void): void; // Will be extended by specific targets
        function onStep(): void; // Will be extended by specific targets

        var LOGGING_LEVEL: LoggingLevel;
    }
}

export { }