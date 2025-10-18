import { normalize } from "../utils.js";

export class Value {
    constructor(type) {
        this.type = type;
    }

    evaluate(stream, context) {
        return this;
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

export class Str extends Value {
    constructor(value) {
        super("string!");
        this.value = value;
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
}

export class Word extends Value {
    constructor(spelling) {
        super("word!");
        this.spelling = normalize(spelling);
    }
    evaluate(stream, context) {
        const value = context.get(this.spelling);
        return value.evaluate(stream, context);
    }
    mold() {
        return this.spelling.description;
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
}

export class Block extends Value {
    constructor(items) {
        super("block!");
        this.items = items;
    }
    append(item) {
        return new Block([...this.items, item]);
    }
    insert(index, item) {
        const indexValue = index.to("number!");
        const itemValue = item.to("block!");
        return new Block([
            ...this.items.slice(0, indexValue.value),
            itemValue,
            ...this.items.slice(indexValue.value),
        ]);
    }
    slice(start, end) {
        const startValue = start.to("number!");
        const endValue = end.to("number!");
        return new Block(this.items.slice(startValue.value, endValue.value));
    }
    length() {
        return new Num(this.items.length);
    }
    mold() {
        return `[${this.items.map((e) => e.mold()).join(" ")}]`;
    }
}

export class Paren extends Value {
    constructor(items) {
        super("paren!");
        this.items = items;
    }
    mold() {
        return `(${
            this.items.map((e) => e instanceof Value ? e.mold() : e).join(" ")
        })`;
    }
}
