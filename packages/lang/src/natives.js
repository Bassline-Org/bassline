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

/// User defined function
export class Fn extends Context {
    constructor(context, args, body) {
        super(context);
        this.set("args", args);
        this.set("body", body);
    }
    mold() {
        return `fn [${this.args.mold()}] [${this.body.mold()}]`;
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
