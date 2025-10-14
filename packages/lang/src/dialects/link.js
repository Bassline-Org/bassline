import { dialectProto } from "../dialectProto.js";
import { isa } from "../utils.js";
import { Block, Word } from "../values.js";

// Link dialect prototype
const linkDialectProto = Object.create(dialectProto);

Object.assign(linkDialectProto, {
    // Override interpret to handle connection patterns
    interpret() {
        const connections = [];

        while (!this.stream.done()) {
            const source = this.stream.next();

            // Pattern: source -> target
            if (this.stream.match(Word, "->")) {
                this.stream.next(); // consume ->
                const target = this.stream.next();
                connections.push({ type: "pipe", source, target });
                continue;
            }

            // Pattern: => with source and target
            if (this.stream.match(Word, "=>")) {
                this.stream.next(); // consume =>
                const target = this.stream.next();

                // If source is a block, it's fanin: [a b] => c
                if (isa(source, Block)) {
                    connections.push({ type: "fanin", sources: source, target });
                }
                // If source is a word and target is a block, it's fanout: a => [b c]
                else if (isa(target, Block)) {
                    connections.push({ type: "fanout", source, targets: target });
                }
                // Otherwise it's a pipe: a => b (same as ->)
                else {
                    connections.push({ type: "pipe", source, target });
                }
                continue;
            }
        }

        this.state.connections = connections;
        return this;
    },

    // Build actual tap connections
    build() {
        const cleanups = [];

        for (const conn of this.state.connections) {
            if (conn.type === "pipe") {
                // a -> b: tap a, feed to b
                const sourceGadget = this.context.get(conn.source.spelling);
                const targetGadget = this.context.get(conn.target.spelling);

                if (!sourceGadget?.tap) {
                    throw new Error(`Source gadget '${conn.source.spelling.description}' has no tap method`);
                }

                const cleanup = sourceGadget.tap((effects) => {
                    if (effects.changed !== undefined) {
                        targetGadget.receive(effects.changed);
                    }
                });

                cleanups.push(cleanup);
            } else if (conn.type === "fanout") {
                // a => [b c d]: tap a, feed to multiple targets
                const sourceGadget = this.context.get(conn.source.spelling);
                const targetStream = conn.targets.stream();
                const targets = [];

                while (!targetStream.done()) {
                    const targetWord = targetStream.next();
                    if (isa(targetWord, Word)) {
                        targets.push(this.context.get(targetWord.spelling));
                    }
                }

                const cleanup = sourceGadget.tap((effects) => {
                    if (effects.changed !== undefined) {
                        targets.forEach((t) => t.receive(effects.changed));
                    }
                });

                cleanups.push(cleanup);
            } else if (conn.type === "fanin") {
                // [a b c] => d: tap multiple sources, feed to one target
                const targetGadget = this.context.get(conn.target.spelling);
                const sourceStream = conn.sources.stream();

                while (!sourceStream.done()) {
                    const sourceWord = sourceStream.next();
                    if (isa(sourceWord, Word)) {
                        const sourceGadget = this.context.get(sourceWord.spelling);
                        const cleanup = sourceGadget.tap((effects) => {
                            if (effects.changed !== undefined) {
                                targetGadget.receive(effects.changed);
                            }
                        });
                        cleanups.push(cleanup);
                    }
                }
            }
        }

        // Return cleanup function to remove all taps
        return () => cleanups.forEach((c) => c());
    },
});

// Interpret a block as link definition
export function interpretLink(block, context) {
    const instance = Object.create(linkDialectProto);
    return instance.enter(block, context);
}

// Export as callable native for prelude
export const linkNative = {
    call(stream, context) {
        const block = stream.next();
        return interpretLink(block, context);
    },
};
