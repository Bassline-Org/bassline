/**
 * @bassline/taps
 *
 * Extension for observing gadget effects via taps.
 * Auto-installs on import.
 */

import { bl } from "@bassline/core";

export function installTaps() {
    const { gadgetProto } = bl();

    if (gadgetProto.tap !== undefined) {
        return;
    }

    const originalEmit = gadgetProto.emit;
    Object.assign(gadgetProto, {
        tap(fn) {
            if (this.taps === undefined) this.taps = new Set();
            this.taps.add(fn);
            return () => this.taps.delete(fn);
        },
        emit(data) {
            originalEmit.call(this, data);
            this.taps?.forEach((fn) => fn(data));
        },
        tapOn(key, fn) {
            return this.tap((effects) => {
                if (effects[key] !== undefined) {
                    fn(effects[key]);
                }
            });
        },
    });
}

// Auto-install on import
installTaps();
