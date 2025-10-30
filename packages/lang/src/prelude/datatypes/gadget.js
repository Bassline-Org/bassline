import { normalize } from "../../utils.js";
import { ContextChain } from "./context.js";
import { datatype, Value, word } from "./core.js";
import { nativeFn } from "./functions.js";
import { TYPES } from "./types.js";

const gadgetType = normalize("gadget!");

export class Gadget extends ContextChain.typed(gadgetType) {
    constructor(parent) {
        super(parent);
    }

    static make(block, context, iter) {
        const [inputs, outputs, state] = block.to(TYPES.block).items;
        const gadget = new Gadget(context);
        gadget.set("/inputs", inputs);
        gadget.set("/outputs", outputs);
        gadget.set("/state", state);
        return gadget;
    }
}

const placeType = normalize("place!");
export class Place extends Value.typed(placeType) {
    constructor(tokens, signal) {
        super([tokens, signal]);
    }
    get tokens() {
        return this.value[0];
    }
    set tokens(newTokens) {
        this.value[0] = newTokens;
    }
    get signal() {
        return this.value[1];
    }
    set signal(newSignal) {
        this.value[1] = newSignal;
    }

    give(amount) {
        this.tokens = this.tokens.add(amount);
    }
    take(amount) {
        const newValue = this.tokens.subtract(amount);
        if (newValue.value < 0) {
            throw new Error(`Not enough tokens to take ${amount}`);
        }
        this.tokens = newValue;
        return newValue;
    }

    mold() {
        return `make place! [${this.tokens.mold()}] [${this.signal.mold()}]`;
    }

    static make(args, context, iter) {
        const [tokens, signal] = args.items;
        return new Place(tokens.to(TYPES.number), signal);
    }
}

export default {
    "gadget!": datatype(Gadget),
    "place!": datatype(Place),
    "tokens": nativeFn("place", (place) => {
        if (place.type === TYPES.block) {
            return new Block(place.items.map((item) => item.tokens));
        }
        return place.tokens;
    }),
    "signal": nativeFn("place", (place) => place.signal),
    "give": nativeFn(
        "place amount",
        (place, amount) => place.give(amount.to(TYPES.number)),
    ),
    "take": nativeFn(
        "place amount",
        (place, amount) => place.take(amount.to(TYPES.number)),
    ),
};
