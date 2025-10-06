const { gadgetProto } = bl();

export function installTaps() {
    if (gadgetProto.tap !== undefined) {
        console.log("Taps already installed");
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
            originalEmit.bind(this, data);
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
