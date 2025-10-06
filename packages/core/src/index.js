export * from "./gadget.js";
import { installBassline } from "./gadget.js";

export function bl() {
    if (globalThis.bassline === undefined) {
        installBassline();
    }
    return globalThis.bassline;
}

globalThis.bl = bl;
