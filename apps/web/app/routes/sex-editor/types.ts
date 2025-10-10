// Shared types for sex-editor

export interface GadgetSpec {
    pkg: string;
    name: string;
    state?: any;
}

export interface HistoryEntry {
    timestamp: number;
    actions: any;
}

export interface EffectEntry {
    timestamp: number;
    gadgetName: string;
    effect: any;
}

export interface ContextMenuState {
    x: number;
    y: number;
    name: string;
    gadget: any;
}
