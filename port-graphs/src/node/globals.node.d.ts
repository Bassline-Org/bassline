// Node.js-specific extensions to BASSLINE globals
declare global {
    namespace BASSLINE {
        // Node.js-specific extensions
        namespace NODE {
            // File system operations
            function saveNetworkToFile(networkId: string, filepath: string): void;
            function loadNetworkFromFile(filepath: string): any;
            
            // Process management
            function spawnWorker(script: string): any;
            function terminateWorker(worker: any): void;
            
            // Node.js-specific hooks
            namespace FS_HOOKS {
                function onNetworkSaved(networkId: string, filepath: string): void;
                function onNetworkLoaded(network: any, filepath: string): void;
            }
        }
    }
}

export {}
