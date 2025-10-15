import { native } from "../natives.js";
import { isa } from "../utils.js";
import { Block } from "../values.js";
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
    context.set("UNSAFE-LAST", cells.unsafeLast);

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
}
