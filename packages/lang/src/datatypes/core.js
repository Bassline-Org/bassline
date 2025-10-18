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

    print() {
        console.log(this);
        return this;
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

export class Block extends Series {
    constructor(items = [], type = "block!") {
        super(items, type);
    }
    mold() {
        return `[${this.items.map((e) => e.mold()).join(" ")}]`;
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

export class Datatype extends Value {
    constructor(aClass, type = "datatype!") {
        super(type);
        this.value = aClass;
    }
}

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
};
