import { native } from "../natives.js";
import { isa } from "../utils.js";
import { Block, SetWord, Word } from "../values.js";
import { evalNext, ex } from "../evaluator.js";
import { basslineToJs, jsToBassline } from "./helpers.js";
import { Context } from "../context.js";
import { bl } from "@bassline/core";
bl();
import cellsPackage from "@bassline/cells";
const { installPackage } = bl();
installPackage(cellsPackage);
const cells = cellsPackage.gadgets;
import { installTaps } from "@bassline/taps";
installTaps();

export function installGadgets(context) {
    // Make cell prototypes available
    context.set("MAX", cells.max);
    context.set("MIN", cells.min);
    context.set("UNION", cells.union);
    context.set("INTERSECTION", cells.intersection);
    context.set("FIRST", cells.first);
    context.set("LAST", cells.last);
    context.set("UNSAFE-LAST", cells.last);

    // gadget <proto> <initial-state>
    // Create a gadget from a prototype with initial state
    context.set(
        "gadget",
        native(async (stream, context) => {
            const proto = await evalNext(stream, context);
            const initialState = await evalNext(stream, context);

            if (!proto || !proto.spawn) {
                throw new Error(
                    "gadget expects a gadget prototype as first argument",
                );
            }

            // Convert initial state from Bassline to JS for gadget
            const jsInitialState = basslineToJs(initialState);
            return proto.spawn(jsInitialState);
        }, {
            doc: "Creates a gadget instance from a prototype with the given initial state.",
            args: ["proto", "initial-state"],
            examples: [
                "counter: gadget MAX 0",
                "counter.receive 5",
                "counter.receive 3",
                "counter.current  ; => 5",
            ],
        }),
    );

    // receive <gadget> <value>
    // Send input to a gadget
    context.set(
        "receive",
        native(async (stream, context) => {
            const gadget = await evalNext(stream, context);
            const input = await evalNext(stream, context);

            if (!gadget || !gadget.receive) {
                throw new Error("receive expects a gadget as first argument");
            }

            // Convert Bassline values to JavaScript primitives for gadgets
            const jsInput = basslineToJs(input);
            gadget.receive(jsInput);
            return gadget;
        }, {
            doc: "Sends an input value to a gadget. Returns the gadget.",
            args: ["gadget", "value"],
            examples: [
                "g: gadget MAX 0",
                "receive g 10",
                "receive g 5",
                "g.current  ; => 10",
            ],
        }),
    );

    // current <gadget>
    // Get current state of a gadget
    context.set(
        "current",
        native(async (stream, context) => {
            const gadget = await evalNext(stream, context);

            if (!gadget || !gadget.current) {
                throw new Error("current expects a gadget");
            }

            // Convert JavaScript value back to Bassline
            const jsValue = gadget.current();
            return jsToBassline(jsValue, context);
        }, {
            doc: "Returns the current state of a gadget.",
            args: ["gadget"],
            examples: [
                "g: gadget MAX 10",
                "current g  ; => 10",
                "receive g 20",
                "current g  ; => 20",
            ],
        }),
    );

    // tap <gadget> <handler>
    // Subscribe to gadget changes
    context.set(
        "tap",
        native(async (stream, context) => {
            const gadget = await evalNext(stream, context);
            const handler = stream.next(); // Keep as block, don't eval

            if (!gadget || !gadget.tap) {
                throw new Error("tap expects a gadget as first argument");
            }

            if (!isa(handler, Block)) {
                throw new Error("tap expects a block as handler");
            }

            // Create tap that executes the block when gadget changes
            const cleanup = gadget.tap(async (effects) => {
                // Create a child context with effects available
                const tapContext = new Context(context);

                // Convert effects to Bassline values
                const basslineEffects = {};
                for (const [key, value] of Object.entries(effects)) {
                    basslineEffects[key] = jsToBassline(value, tapContext);
                }

                tapContext.set(Symbol.for("EFFECTS"), basslineEffects);

                // Also make specific effect values available as variables
                if (effects.changed !== undefined) {
                    tapContext.set(Symbol.for("CHANGED"), jsToBassline(effects.changed, tapContext));
                }

                // Execute the handler block in the tap context
                await ex(tapContext, handler);
            });

            return cleanup;
        }, {
            doc: "Subscribes to changes from a gadget. Handler block is executed when gadget updates.",
            args: ["gadget", "handler"],
            examples: [
                "g: gadget MAX 0",
                'tap g [print "Changed!"]',
                'receive g 10  ; Prints "Changed!"',
            ],
        }),
    );

    // gadget-system <block>
    // Create a gadget system with declarations and tap handlers
    context.set(
        "gadget-system",
        native(async (stream, context) => {
            const block = stream.next();

            if (!isa(block, Block)) {
                throw new Error("gadget-system expects a block");
            }

            // Create child context extending parent
            const gsContext = new Context(context);

            // Track created gadgets and taps for cleanup
            const gadgets = new Map();
            const cleanups = [];

            // Bind gadget-system functions
            bindGadgetSystemFunctions(gsContext, context, gadgets, cleanups);

            // Execute the block - special bindings handle everything
            await ex(gsContext, block);

            // Copy gadget bindings from child context to parent context
            // Only copy bindings that were created in THIS context (not inherited from parent)
            for (const [key, value] of gsContext.bindings) {
                // Skip if this binding exists in parent (inherited, not created here)
                if (context.bindings.has(key)) {
                    continue;
                }

                // Copy bindings that look like gadgets (have tap/receive/current)
                if (value && typeof value === 'object' && value.tap && value.receive && value.current) {
                    context.set(key.description, value);
                    gadgets.set(key.description, value);
                }
            }

            // Store metadata in parent context
            // Use a different symbol to avoid conflicts
            context.set(Symbol.for("BASSLINE-GADGET-SYSTEM-META"), {
                gadgets,
                cleanups,
            });

            // Return combined cleanup function as a Bassline native
            return native(async (stream, ctx) => {
                cleanups.forEach((c) => c());
                for (const [key] of gadgets.entries()) {
                    // Remove from context bindings
                    const normalized = context.bindings.keys();
                    for (const k of normalized) {
                        if (k.description === key) {
                            context.bindings.delete(k);
                            break;
                        }
                    }
                }
            });
        }, {
            doc: "Creates a gadget system with declarative gadget creation and tap handlers. Returns cleanup function.",
            args: ["block"],
            examples: [
                "cleanup: gadget-system [",
                "  counter: max 0",
                "  on counter [print (current counter)]",
                "]",
                "receive counter 5",
                "cleanup  ; Tears down system",
            ],
        }),
    );
}

// Helper: Bind special functions for gadget-system context
function bindGadgetSystemFunctions(gsContext, parentContext, gadgets, cleanups) {
    // Cell type constructors - create and auto-register gadgets
    const createConstructor = (proto, typeName) => {
        return native(async (stream, context) => {
            const initialState = await evalNext(stream, context);
            const jsState = basslineToJs(initialState);
            const gadget = proto.spawn(jsState);

            // Store gadget for later reference
            return gadget;
        });
    };

    // Bind all cell types
    gsContext.set("max", createConstructor(cells.max, "max"));
    gsContext.set("min", createConstructor(cells.min, "min"));
    gsContext.set("union", createConstructor(cells.union, "union"));
    gsContext.set("intersection", createConstructor(cells.intersection, "intersection"));
    gsContext.set("first", createConstructor(cells.first, "first"));
    gsContext.set("last", createConstructor(cells.last, "last"));
    gsContext.set("unsafe-last", createConstructor(cells.last, "unsafe-last"));

    // Tap functions

    // on <gadget> <handler>
    gsContext.set("on", native(async (stream, context) => {
        const gadget = await evalNext(stream, context);
        const handler = stream.next();

        if (!gadget || !gadget.tap) {
            throw new Error("on expects a gadget as first argument");
        }

        if (!isa(handler, Block)) {
            throw new Error("on expects a block as handler");
        }

        const cleanup = gadget.tap(async (effects) => {
            const tapContext = new Context(context);
            tapContext.set(Symbol.for("EFFECTS"), jsToBassline(effects, tapContext));
            if (effects.changed !== undefined) {
                tapContext.set(Symbol.for("CHANGED"), jsToBassline(effects.changed, tapContext));
            }
            await ex(tapContext, handler);
        });

        cleanups.push(cleanup);
        return cleanup;
    }));

    // filter <gadget> <condition> <handler>
    gsContext.set("filter", native(async (stream, context) => {
        const gadget = await evalNext(stream, context);
        const condition = stream.next();
        const handler = stream.next();

        if (!gadget || !gadget.tap) {
            throw new Error("filter expects a gadget as first argument");
        }

        if (!isa(condition, Block)) {
            throw new Error("filter expects a block as condition");
        }

        if (!isa(handler, Block)) {
            throw new Error("filter expects a block as handler");
        }

        const cleanup = gadget.tap(async (effects) => {
            const tapContext = new Context(context);
            tapContext.set(Symbol.for("EFFECTS"), jsToBassline(effects, tapContext));
            if (effects.changed !== undefined) {
                tapContext.set(Symbol.for("CHANGED"), jsToBassline(effects.changed, tapContext));
            }

            const condResult = await ex(tapContext, condition);
            if (basslineToJs(condResult)) {
                await ex(tapContext, handler);
            }
        });

        cleanups.push(cleanup);
        return cleanup;
    }));

    // debounce <gadget> <ms> <handler>
    gsContext.set("debounce", native(async (stream, context) => {
        const gadget = await evalNext(stream, context);
        const ms = basslineToJs(await evalNext(stream, context));
        const handler = stream.next();

        if (!gadget || !gadget.tap) {
            throw new Error("debounce expects a gadget as first argument");
        }

        if (!isa(handler, Block)) {
            throw new Error("debounce expects a block as handler");
        }

        let timer = null;
        const cleanup = gadget.tap(async (effects) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(async () => {
                const tapContext = new Context(context);
                tapContext.set(Symbol.for("EFFECTS"), jsToBassline(effects, tapContext));
                if (effects.changed !== undefined) {
                    tapContext.set(Symbol.for("CHANGED"), jsToBassline(effects.changed, tapContext));
                }
                await ex(tapContext, handler);
            }, ms);
        });

        const fullCleanup = () => {
            if (timer) clearTimeout(timer);
            cleanup();
        };
        cleanups.push(fullCleanup);
        return fullCleanup;
    }));

    // throttle <gadget> <ms> <handler>
    gsContext.set("throttle", native(async (stream, context) => {
        const gadget = await evalNext(stream, context);
        const ms = basslineToJs(await evalNext(stream, context));
        const handler = stream.next();

        if (!gadget || !gadget.tap) {
            throw new Error("throttle expects a gadget as first argument");
        }

        if (!isa(handler, Block)) {
            throw new Error("throttle expects a block as handler");
        }

        let lastRun = 0;
        const cleanup = gadget.tap(async (effects) => {
            const now = Date.now();
            if (now - lastRun >= ms) {
                lastRun = now;
                const tapContext = new Context(context);
                tapContext.set(Symbol.for("EFFECTS"), jsToBassline(effects, tapContext));
                if (effects.changed !== undefined) {
                    tapContext.set(Symbol.for("CHANGED"), jsToBassline(effects.changed, tapContext));
                }
                await ex(tapContext, handler);
            }
        });

        cleanups.push(cleanup);
        return cleanup;
    }));

    // pipe <gadget-list> <handler>
    gsContext.set("pipe", native(async (stream, context) => {
        const gadgetList = stream.next();
        const handler = stream.next();

        if (!isa(gadgetList, Block)) {
            throw new Error("pipe expects a block of gadgets as first argument");
        }

        if (!isa(handler, Block)) {
            throw new Error("pipe expects a block as handler");
        }

        // Set up tap for each gadget
        for (const gadgetName of gadgetList.items) {
            const gadget = await evalNext(gadgetName, context);
            if (!gadget || !gadget.tap) {
                throw new Error(`pipe: ${gadgetName} is not a gadget`);
            }

            const cleanup = gadget.tap(async (effects) => {
                const tapContext = new Context(context);
                tapContext.set(Symbol.for("GADGET-NAME"), gadgetName);
                tapContext.set(Symbol.for("EFFECTS"), jsToBassline(effects, tapContext));
                if (effects.changed !== undefined) {
                    tapContext.set(Symbol.for("CHANGED"), jsToBassline(effects.changed, tapContext));
                }
                await ex(tapContext, handler);
            });

            cleanups.push(cleanup);
        }

        return () => {}; // Cleanups already tracked
    }));

    // take <gadget> <count> <handler>
    gsContext.set("take", native(async (stream, context) => {
        const gadget = await evalNext(stream, context);
        const maxCount = basslineToJs(await evalNext(stream, context));
        const handler = stream.next();

        if (!gadget || !gadget.tap) {
            throw new Error("take expects a gadget as first argument");
        }

        if (!isa(handler, Block)) {
            throw new Error("take expects a block as handler");
        }

        let count = 0;
        let cleanup;

        cleanup = gadget.tap(async (effects) => {
            if (count >= maxCount) {
                return;
            }
            count++;

            const tapContext = new Context(context);
            tapContext.set(Symbol.for("EFFECTS"), jsToBassline(effects, tapContext));
            if (effects.changed !== undefined) {
                tapContext.set(Symbol.for("CHANGED"), jsToBassline(effects.changed, tapContext));
            }
            await ex(tapContext, handler);

            if (count >= maxCount) {
                cleanup();
            }
        });

        cleanups.push(cleanup);
        return cleanup;
    }));
}
