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

    /**
     * Lifecycle hook called after spawning a gadget
     * By default it updates the state to the initial state
     * @param {*} initial
     */
    afterSpawn(initial) {
        this.update(initial);
    },
    /**
     * Kills a gadget, invokes the cleanup hook after emitting the killed effect
     */
    kill() {
        this.emit({ killed: true });
        this.onKill();
    },

    /**
     * Lifecycle hook called after killing a gadget
     * By default it sets the state to null
     */
    onKill() {
        this[StateSymbol] = null;
    },
    /**
     * Serializes a gadget into a re-hydratable spec
     * @returns {Object} - Gadget spec
     */
    toSpec() {
        return {
            pkg: this.pkg,
            name: this.name,
            state: this.stateSpec(),
        };
    },
    /**
     * Serialzies the state of a gadget into a re-hydratable spec
     * @returns {Object} - Gadget state
     */
    stateSpec() {
        return this.current();
    },
};
