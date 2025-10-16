import { Context } from "./context";

export class NativeFn extends Context {
    constructor(fn) {
        super();
        this.fn = fn;
    }
    mold() {
        return "native";
    }
}

// Helper to create native callable functions
export function native(fn, metadata = {}) {
    const native = new NativeFn(fn);
    for (const [key, value] of Object.entries(metadata)) {
        native.set(key, value);
    }
    return native;
}
