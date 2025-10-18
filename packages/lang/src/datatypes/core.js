import { normalize } from "../utils.js";

export class Value {
    constructor(type) {
        this.type = type;
    }

    evaluate(stream, context) {
        return this;
    }

    getType() {
        return new Str(this.type);
    }

    to(type) {
        if (this.type !== type) {
            throw new Error(`Cannot convert ${this.type} to ${type}`);
        }
        return this;
    }
}

export class Num extends Value {
    constructor(value) {
        super("number!");
        this.value = value;
    }

    to(type) {
        if (type === "number!") {
            return this;
        }
        if (type === "string!") {
            return new Str(String(this.value));
        }
        throw new Error(`Cannot convert ${this.type} to ${type}`);
    }

    add(other) {
        const otherValue = other.to("number!");
        return new Num(this.value + otherValue.value);
    }

    subtract(other) {
        const otherValue = other.to("number!");
        return new Num(this.value - otherValue.value);
    }

    multiply(other) {
        const otherValue = other.to("number!");
        return new Num(this.value * otherValue.value);
    }

    divide(other) {
        const otherValue = other.to("number!");
        return new Num(this.value / otherValue.value);
    }
}

export class Series extends Value {
    constructor(items = []) {
        super("series!");
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
    constructor(value) {
        super(Array.from(value));
        this.value = value;
        this.type = "string!";
    }

    to(type) {
        if (type === "number!") {
            return new Num(Number(this.value));
        }
        if (type === "word!") {
            return new Word(this.value);
        }
        if (type === "set-word!") {
            return new SetWord(this.value);
        }
        if (type === "get-word!") {
            return new GetWord(this.value);
        }
        if (type === "lit-word!") {
            return new LitWord(this.value);
        }
        if (type !== "string!") {
            throw new Error(`Cannot convert ${this.type} to ${type}`);
        }
        return this;
    }

    append(other) {
        const otherValue = other.to("string!");
        return new Str(this.value + otherValue.value);
    }

    insert(index, other) {
        const indexValue = index.to("number!");
        const otherValue = other.to("string!");
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
}

export class Word extends Value {
    constructor(spelling) {
        super("word!");
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
    constructor(spelling) {
        super("get-word!");
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
    constructor(spelling) {
        super("set-word!");
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
    constructor(spelling) {
        super("lit-word!");
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
    constructor(items = []) {
        super(items);
        this.type = "block!";
    }
    mold() {
        return `[${this.items.map((e) => e.mold()).join(" ")}]`;
    }
    static make(stream, context) {
        return new Block([]);
    }
}

export class Paren extends Series {
    constructor(items = []) {
        super(items);
        this.type = "paren!";
    }
    mold() {
        return `(${
            this.items.map((e) => e instanceof Value ? e.mold() : e).join(" ")
        })`;
    }
    static make(stream, context) {
        return new Paren([]);
    }
}

export class Datatype extends Value {
    constructor(aClass) {
        super("datatype!");
        this.aClass = aClass;
    }
}

let nil;
export class Nil extends Value {
    constructor() {
        super("nil!");
        if (!nil) {
            nil = this;
        }
    }
    evaluate(stream, context) {
        return nil;
    }
    static make(stream, context) {
        return nil;
    }
}

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
    "nil": new Nil(),
};
