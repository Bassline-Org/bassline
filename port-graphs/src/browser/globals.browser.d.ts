// Browser-specific extensions to BASSLINE globals
declare global {
    namespace BASSLINE {
        // Browser-specific extensions
        namespace BROWSER {
            // UI event emission
            function emitUIEvent(eventType: string, data: any): void;
            
            // DOM element tracking
            var gadgetElements: Map<string, HTMLElement>;
            var networkElements: Map<string, HTMLElement>;
            
            // Browser-specific hooks
            namespace UI_HOOKS {
                function onNetworkCreated(network: any): void;
                function onCellValueChanged(cellId: string, value: any, source: string): void;
                function onGadgetConnected(fromId: string, toId: string, port: string): void;
                function onGadgetDisconnected(fromId: string, toId: string, port: string): void;
            }
        }
    }
}

export {}