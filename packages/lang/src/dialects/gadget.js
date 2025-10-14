import { dialectProto } from "../dialectProto.js";
import { Block } from "../values.js";

// Gadget dialect prototype
const gadgetDialectProto = Object.create(dialectProto);

Object.assign(gadgetDialectProto, {
    // Keyword: validate [block]
    [Symbol.for("VALIDATE")]() {
        this.state.validateBlock = this.stream.expect(Block);
    },

    // Keyword: step [block]
    [Symbol.for("STEP")]() {
        this.state.stepBlock = this.stream.expect(Block);
    },

    // Keyword: handle [block]
    [Symbol.for("HANDLE")]() {
        this.state.handleBlock = this.stream.expect(Block);
    },

    // Build the actual gadget prototype
    build() {
        // Import bl dynamically to avoid circular deps
        // For now, we'll create a minimal proto structure
        // Later this will integrate with @bassline/core

        const gadgetProto = {
            pkg: this.state[Symbol.for("PKG")]?.value || "@unknown/gadgets",
            name: this.state[Symbol.for("NAME")]?.value || "unnamed",
            _initialState: this.state[Symbol.for("STATE")]?.value ?? 0,

            // Store the blocks for later compilation
            _validateBlock: this.state.validateBlock,
            _stepBlock: this.state.stepBlock,
            _handleBlock: this.state.handleBlock,

            // Placeholder methods - these would be compiled from blocks
            spawn(initialState) {
                const instance = Object.create(this);
                instance._state = initialState ?? this._initialState;
                return instance;
            },

            receive(input) {
                // For now, just store it
                // In full implementation, this would execute step/handle
                this._state = input;
            },

            current() {
                return this._state;
            },
        };

        return gadgetProto;
    },
});

// Interpret a block as gadget definition
export function interpretGadget(block, context) {
    const instance = Object.create(gadgetDialectProto);
    return instance.enter(block, context);
}

// Export as callable native for prelude
export const gadgetNative = {
    call(stream, context) {
        const block = stream.next();
        return interpretGadget(block, context);
    },
};
