import { evaluate } from "../evaluator.js";
import { normalize, normalizeString } from "../utils.js";

export class Value {
    constructor(type) {
        this.type = normalizeString(type);
    }

    evaluate(stream, context) {
        return this;
    }

    getType() {
        return new Str(this.type);
    }

    to(type) {
        const normalizedType = normalizeString(type);
        if (this.type !== normalizedType) {
            throw new Error(`Cannot convert ${this.type} to ${normalizedType}`);
        }
        return this;
    }

    equals(other) {
        const otherValue = other.to(this.type);
        return new Bool(this.value === otherValue.value);
    }

    print() {
        console.log(this);
        return this;
    }
}

export class Bool extends Value {
    constructor(value, type = "bool!") {
        super(type);
        this.value = value;
    }

    to(type) {
        const normalizedType = normalizeString(type);
        if (normalizedType === "NUMBER!") {
            return new Num(this.value ? 1 : 0);
        }
        return super.to(normalizedType);
    }
    print() {
        console.log(this.value);
        return this;
    }
    static make(stream, context) {
        throw new Error("Cannot make new bool! values, these are singletons!");
    }
}

export class Num extends Value {
    constructor(value, type = "number!") {
        super(type);
        this.value = value;
    }

    to(type) {
        const normalizedType = normalizeString(type);
        if (normalizedType === "STRING!") {
            return new Str(String(this.value));
        }
        return super.to(normalizedType);
    }

    add(other) {
        const otherValue = other.to(this.type);
        return new Num(this.value + otherValue.value);
    }

    subtract(other) {
        const otherValue = other.to(this.type);
        return new Num(this.value - otherValue.value);
    }

    multiply(other) {
        const otherValue = other.to(this.type);
        return new Num(this.value * otherValue.value);
    }

    divide(other) {
        const otherValue = other.to(this.type);
        return new Num(this.value / otherValue.value);
    }
    print() {
        console.log(this.value);
        return this;
    }
}

export class Series extends Value {
    constructor(items = [], type = "series!") {
        super(type);
        this.items = items;
    }

    equals(other) {
        const otherValue = other.to(this.type);
        if (this.items.length !== otherValue.items.length) {
            return new Bool(false);
        }
        return new Bool(
            this.items.every((item, index) =>
                item.equals(otherValue.items[index])
            ),
        );
    }

    append(item) {
        return new this.constructor([...this.items, item]);
    }
    insert(index, item) {
        const indexValue = index.to("number!");
        return new this.constructor([
            ...this.items.slice(0, indexValue.value),
            item,
            ...this.items.slice(indexValue.value),
        ]);
    }
    slice(start, end) {
        const startValue = start.to("number!");
        const endValue = end.to("number!");
        return new this.constructor(
            this.items.slice(startValue.value, endValue.value),
        );
    }
    length() {
        return new Num(this.items.length);
    }
    pick(index) {
        const indexValue = index.to("number!");
        return this.items[indexValue.value];
    }
}

export class Str extends Series {
    constructor(value, type = "string!") {
        super(Array.from(value), type);
        this.value = value;
    }

    to(type) {
        const normalizedType = normalizeString(type);
        if (normalizedType === "NUMBER!") {
            return new Num(Number(this.value));
        }
        if (normalizedType === "WORD!") {
            return new Word(this.value);
        }
        if (normalizedType === "SET-WORD!") {
            return new SetWord(this.value);
        }
        if (normalizedType === "GET-WORD!") {
            return new GetWord(this.value);
        }
        if (normalizedType === "LIT-WORD!") {
            return new LitWord(this.value);
        }
        if (normalizedType !== "STRING!") {
            throw new Error(`Cannot convert ${this.type} to ${normalizedType}`);
        }
        return this;
    }

    append(other) {
        const otherValue = other.to(this.type);
        return new Str(this.value + otherValue.value);
    }

    insert(index, other) {
        const indexValue = index.to("number!");
        const otherValue = other.to(this.type);
        return new Str(
            this.value.slice(0, indexValue.value) + otherValue.value +
                this.value.slice(indexValue.value),
        );
    }
    slice(start, end) {
        const startValue = start.to("number!");
        const endValue = end.to("number!");
        return new Str(this.value.slice(startValue.value, endValue.value));
    }
    length() {
        return new Num(this.value.length);
    }

    static make(stream, context) {
        return new Str("");
    }
    print() {
        console.log(this.value);
        return this;
    }
}

export class Block extends Series {
    constructor(items = [], type = "block!") {
        super(items, type);
    }
    mold() {
        return `[${this.items.map((e) => e.mold()).join(" ")}]`;
    }
    reduce() {
        return new Block(this.items.map((item) => evaluate(item, context)));
    }
    /**
     * Compose will evaluate paren items, and recursively compose blocks
     * This is useful for dynamically generating code
     * @returns {Block} - A new block with the paren items evaluated, and blocks composed
     */
    compose() {
        return new Block(this.items.map((item) => {
            if (item instanceof Paren) {
                return item.evaluate(stream, context);
            }
            if (item instanceof Block) {
                return item.compose();
            }
            return item;
        }));
    }
    static make(stream, context) {
        return new Block([]);
    }
}

export class Paren extends Series {
    constructor(items = [], type = "paren!") {
        super(items, type);
    }
    mold() {
        return `(${
            this.items.map((e) => e instanceof Value ? e.mold() : e).join(" ")
        })`;
    }
    evaluate(stream, context) {
        return evaluate(this, context);
    }
    static make(stream, context) {
        return new Paren([]);
    }
}

// =================================
// Word types
// =================================
// Words are similar to symbols in other languages
// They can be used as variables
/**
 * Word is like a variable name.
 *
 * When it evaluates, it will look up the value for the spelling in the context
 * And if it is a function, it will execute it
 * @param {string} spelling - The spelling of the word
 * @returns {Word} - The word value
 */
export class Word extends Value {
    constructor(spelling, type = "word!") {
        super(type);
        this.spelling = normalize(spelling);
    }
    evaluate(stream, context) {
        const value = context.get(this.spelling);
        if (!value) {
            return nil;
        }
        return value.evaluate(stream, context);
    }
    mold() {
        return this.spelling.description;
    }

    static make(stream, context) {
        const next = stream.next();
        return new Word(next.to("word!").spelling);
    }
}
/**
 * Get word is similar to {Word}, however if the value is a function, it will not execute it,
 */
export class GetWord extends Value {
    constructor(spelling, type = "get-word!") {
        super(type);
        this.spelling = normalize(spelling);
    }
    evaluate(stream, context) {
        return context.get(this.spelling);
    }
    mold() {
        return `:${this.spelling.description}`;
    }
    static make(stream, context) {
        const next = stream.next();
        return next.to("get-word!");
    }
}

/**
 * Set word will set the value for the spelling in the context
 */
export class SetWord extends Value {
    constructor(spelling, type = "set-word!") {
        super(type);
        this.spelling = normalize(spelling);
    }
    evaluate(stream, context) {
        let value = stream.next();
        value = value.evaluate(stream, context);
        context.set(this.spelling, value);
        return value;
    }
    mold() {
        return `${this.spelling.description}:`;
    }
    static make(stream, context) {
        const next = stream.next();
        return next.to("set-word!");
    }
}
/**
 * Lit word when evaluated, will return a {Word} value, with the spelling of the literal word
 */
export class LitWord extends Value {
    constructor(spelling, type = "lit-word!") {
        super(type);
        this.spelling = normalize(spelling);
    }
    evaluate(stream, context) {
        return new Word(this.spelling);
    }
    mold() {
        return `'${this.spelling.description}`;
    }
    static make(stream, context) {
        const next = stream.next();
        return next.to("lit-word!");
    }
}

// Datatype is a type that represents a class of values
// It is only used via `make` to create a new basic instance of that type
// As well as for type checking, since type? returns a datatype! value
// And we can compare them using eq?
export class Datatype extends Value {
    constructor(aClass, type = "datatype!") {
        super(type);
        this.value = aClass;
    }
}

// Nil value
// We don't export this, because it's a singleton, and should be used via `nil`
// That's also why the make method throws an error
class Nil extends Value {
    constructor(type = "nil!") {
        super(type);
        if (!Nil.nil) {
            Nil.nil = this;
        }
    }
    evaluate(stream, context) {
        return this;
    }
    equals(other) {
        return other === this ? Bool.t : Bool.f;
    }
    static nil;
    static make(stream, context) {
        return Nil.nil;
    }
}

export const nil = new Nil();

export default {
    "number!": new Datatype(Num),
    "series!": new Datatype(Series),
    "string!": new Datatype(Str),
    "word!": new Datatype(Word),
    "get-word!": new Datatype(GetWord),
    "set-word!": new Datatype(SetWord),
    "lit-word!": new Datatype(LitWord),
    "block!": new Datatype(Block),
    "paren!": new Datatype(Paren),
    "nil!": new Datatype(Nil),
    "nil": nil,
    "true": new Bool(true),
    "false": new Bool(false),
};
