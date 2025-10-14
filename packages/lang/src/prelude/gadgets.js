import { native, evalValue } from "../natives.js";
import { isa } from "../utils.js";
import { Word, SetWord } from "../values.js";

export function installGadgets(context) {
    // spawn <proto> [<state>]
    // Spawns a gadget instance from a prototype
    context.set(
        "spawn",
        native(async (stream, context) => {
            const proto = evalValue(stream.next(), context);
            const stateArg = stream.peek();

            let initialState;
            if (stateArg && !isa(stateArg, Word) && !isa(stateArg, SetWord)) {
                // Has explicit state argument
                initialState = evalValue(stream.next(), context);
            } else {
                // Use proto's default
                initialState = proto._initialState ?? 0;
            }

            return proto.spawn(initialState);
        }),
    );

    // send <gadget> <value>
    // Send a value to a gadget (calls receive)
    context.set(
        "send",
        native(async (stream, context) => {
            const gadget = evalValue(stream.next(), context);
            const input = evalValue(stream.next(), context);
            gadget.receive(input);
        }),
    );

    // current <gadget>
    // Get current state of a gadget
    context.set(
        "current",
        native(async (stream, context) => {
            const gadget = evalValue(stream.next(), context);
            return gadget.current();
        }),
    );
}
