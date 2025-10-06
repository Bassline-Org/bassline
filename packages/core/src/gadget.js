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
        const action = this.step(this.current(), validated);
        if (action !== undefined) {
            this.handle(action);
        }
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
        this.emit({ changed: { old, newState } });
    },
    /**
     * Emit effects
     * @param {any} data - Data to emit
     * Does nothing by default, open for extension!
     */
    emit(_data) {},
};

export function Gadget(step, initial) {
    this.step = step;
    this.update(initial);
}
Gadget.prototype = gadgetProto;

export function installBassline() {
    if (
        typeof globalThis !== "undefined"
    ) {
        globalThis.bassline = globalThis.bassline || {};
        globalThis.bassline.Gadget = Gadget;
        globalThis.bassline.StateSymbol = StateSymbol;
        globalThis.bassline.gadgetProto = gadgetProto;
    }
}
