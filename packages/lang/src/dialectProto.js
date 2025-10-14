import { isa } from "./utils.js";
import { SetWord, Word } from "./values.js";

// Base prototype for all dialects
export const dialectProto = {
    // Entry point - called when dialect is invoked
    enter(block, context) {
        this.block = block;
        this.context = context;
        this.stream = block.stream();
        this.state = {};
        return this.interpret();
    },

    // Default interpretation: iterate stream and dispatch
    interpret() {
        while (!this.stream.done()) {
            const current = this.stream.next();

            // Handle SetWord: field assignment (field: value)
            if (isa(current, SetWord)) {
                const value = this.stream.next();
                this.state[current.spelling] = value;
                continue;
            }

            // Handle Word: check for keyword method
            if (isa(current, Word)) {
                const handler = this[current.spelling];
                if (typeof handler === "function") {
                    handler.call(this);
                    continue;
                }
            }

            // Unknown pattern - could be overridden by subclass
            this.handleUnknown(current);
        }

        return this.build();
    },

    // Override this to handle unexpected values
    handleUnknown(value) {
        throw new Error(`Unexpected value in dialect: ${value.constructor.name}`);
    },

    // Override this to build final result from state
    build() {
        return this.state;
    },
};
