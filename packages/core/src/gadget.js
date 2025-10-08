// Symbol for state to prevent random access
export const StateSymbol = Symbol("bassline-state");

export const gadgetProto = {
    /**
     * Accept input
     * @param {any} input - Input
     */
    receive(input) {
        const validated = this.validate(input);
        if (validated === undefined) return;
        this.step(this.current(), validated);
    },
    /**
     * Validate input, or returns undefined if invalid
     * @param {any} input - Input
     * @returns {any | undefined} - Validated input
     */
    validate(input) {
        return input;
    },
    [StateSymbol]: null,
    /**
     * Get current state
     * @returns {any} - Current state
     */
    current() {
        return this[StateSymbol];
    },
    /**
     * Updates state, for internal use only!
     * Should only be called by the step function
     * If you need to update the state from outside, use the receive function!
     * @param {any} newState - New state
     */
    update(newState) {
        const old = this.current();
        this[StateSymbol] = newState;
        this.emit({ changed: newState, delta: { old, newState } });
    },
    /**
     * Emit effects
     * @param {any} data - Data to emit
     * Does nothing by default, open for extension!
     */
    emit(_data) {},
    spawn(initial) {
        const g = Object.create(this);
        g.afterSpawn(initial);
        return g;
    },
    afterSpawn(initial) {
        this.update(initial);
    },
    /**
     * Get package metadata for this gadget (if available)
     * @returns {Object|null} Metadata object or null
     */
    getMetadata() {
        return this.metadata || null;
    },
};

export function installBassline() {
    if (
        typeof globalThis !== "undefined"
    ) {
        globalThis.bassline = globalThis.bassline || {};
        globalThis.bassline.StateSymbol = StateSymbol;
        globalThis.bassline.gadgetProto = gadgetProto;
        globalThis.bassline.packages = globalThis.bassline.packages || {};
    }
}
