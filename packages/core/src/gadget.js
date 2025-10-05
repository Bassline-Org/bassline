// Symbol for state to prevent random access
export const StateSymbol = Symbol("bassline-state");

export const gadgetProto = {
    receive(input) {
        const action = this.step(this.current(), input);
        if (action !== undefined) {
            this.handle(action);
        }
    },
    [StateSymbol]: null,
    current() {
        return this[StateSymbol];
    },
    update(newState) {
        const old = this.current();
        this[StateSymbol] = newState;
        this.emit({ changed: { old, newState } });
    },
    emit(data) {},
};

export function Gadget(step, initial) {
    this.step = step;
    this.update(initial);
}
Gadget.prototype = gadgetProto;

export function installBassline() {
    if (typeof window !== "undefined") {
        window.bassline = {
            Gadget,
            StateSymbol,
            gadgetProto,
        };
    }
}
