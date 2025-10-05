import { gadgetProto } from "./gadget.js";

export function installTaps() {
    const originalEmit = gadgetProto.emit;
    Object.assign(gadgetProto, {
        tap(fn) {
            return this.addTap(fn);
        },
        addTap(fn) {
            if (this.taps === undefined) {
                this.taps = new Set();
            }
            this.taps.add(fn);
            return () => this.taps.delete(fn);
        },
        emit(data) {
            originalEmit.bind(this, data);
            this.taps?.forEach((fn) => fn(data));
        },
    });
}
