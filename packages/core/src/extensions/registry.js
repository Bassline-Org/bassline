export const idSymbol = Symbol("bassline-id");

export function getGadgetById(id) {
    const entry = globalThis.bassline.registry.get(id);
    return entry instanceof WeakRef ? entry.deref() : entry;
}

export function installRegistry() {
    if (globalThis.bassline.registry !== undefined) {
        return;
    }

    // The registry is a map of ids to weak references to gadgets
    /**
     * @type {Map<string, WeakRef<Gadget>>}
     * @default new Map()
     * @description The registry is a map of ids to weak references to gadgets. DO NOT USE THE REGISTRY DIRECTLY!
     * Use the getGadgetById function instead to access gadgets by id.
     * Or access the id property of the gadget to get the id!
     */
    globalThis.bassline.registry = globalThis.bassline.registry ||
        new Map();

    Object.assign(globalThis.bassline.gadgetProto, {
        id() {
            if (this[idSymbol] === undefined) {
                this[idSymbol] = Date.now().toString(36);
                console.log("Setting id", this[idSymbol]);
                globalThis.bassline.registry.set(
                    this[idSymbol],
                    new WeakRef(this),
                );
            }
            return this[idSymbol];
        },
    });
}
