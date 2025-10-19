import { evaluate } from "../evaluator.js";
import { normalize, normalizeString } from "../utils.js";

export class Value {
    static type = normalizeString("value!");

    evaluate(stream, context) {
        return this;
    }

    get type() {
        return this.constructor.type;
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

    form() {
        return new Str(this.value);
    }

    doc(doc) {
        const docString = doc.to("STRING!");
        this.documentation = docString;
    }

    describe() {
        return this.documentation ?? nil;
    }

    equals(other) {
        const otherValue = other.to(this.type);
        return new Bool(this.value === otherValue.value);
    }

    print() {
        console.log(this.form().value);
        return this;
    }
}

export class Bool extends Value {
    static type = normalizeString("bool!");
    constructor(value) {
        super();
        this.value = value;
    }

    to(type) {
        const normalizedType = normalizeString(type);
        if (normalizedType === "NUMBER!") {
            return new Num(this.value ? 1 : 0);
        }
        return super.to(normalizedType);
    }
    static make(stream, context) {
        throw new Error("Cannot make new bool! values, these are singletons!");
    }
}

export class Num extends Value {
    static type = normalizeString("number!");
    constructor(value) {
        super();
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
}

export class Series extends Value {
    static type = normalizeString("series!");
    constructor(items = []) {
        super();
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
    concat(other) {
        const otherValue = other.to(this.type);
        return new this.constructor([...this.items, ...otherValue.items]);
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
    form() {
        return new Str(
            `[ ${this.items.map((item) => item.form().value).join(" ")} ]`,
        );
    }
    fold(fn, initial, stream, context) {
        return this.items.reduce(
            (acc, curr) => {
                const expr = new Block([fn, acc, curr]);
                return evaluate(expr, context);
            },
            initial,
        );
    }
    map(fn, stream, context) {
        const result = this.items.map((item) => {
            const expr = new Block([fn, item]);
            return evaluate(expr, context);
        });
        return new this.constructor(result);
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
        const value = this.items[indexValue.value];
        return value;
    }
}

export class Str extends Value {
    static type = normalizeString("string!");
    constructor(value) {
        super();
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
        return super.to(normalizedType);
    }

    form() {
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
    pick(index) {
        const indexValue = index.to("number!");
        return new Str(this.value[indexValue.value]);
    }
    pluck(index) {
        const indexValue = index.to("number!");
        return new Str(
            this.value.slice(0, indexValue.value) +
                this.value.slice(indexValue.value + 1),
        );
    }

    static make(stream, context) {
        return new Str("");
    }
}

export class Block extends Series {
    static type = normalizeString("block!");
    constructor(items = []) {
        super(items);
    }
    /**
     * Reduce will evaluate each item in the block, and return a new block with the results
     * It will not deeply evaluate
     * @param {*} stream
     * @param {*} context
     * @returns
     */
    reduce(stream, context) {
        return new Block(this.items.map((item) => evaluate(item, context)));
    }
    /**
     * Compose will evaluate paren items, and recursively compose blocks
     * This is useful for dynamically generating code
     * @returns {Block} - A new block with the paren items evaluated, and blocks composed
     */
    compose(stream, context) {
        return new Block(this.items.map((item) => {
            if (item instanceof Paren) {
                return item.evaluate(stream, context);
            }
            if (item instanceof Block) {
                return item.compose(stream, context);
            }
            return item;
        }));
    }
    static make(stream, context) {
        return new Block([]);
    }
}

export class Paren extends Series {
    static type = normalizeString("paren!");
    constructor(items = []) {
        super(items);
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
    static type = normalizeString("word!");
    constructor(spelling) {
        super();
        this.spelling = normalize(spelling);
    }
    evaluate(stream, context) {
        const value = context.get(this);
        if (!value) {
            return nil;
        }
        return value.evaluate(stream, context);
    }
    mold() {
        return this.spelling.description;
    }
    form() {
        return new Str(this.spelling.description);
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
    static type = normalizeString("get-word!");
    constructor(spelling) {
        super();
        this.spelling = normalize(spelling);
    }
    evaluate(stream, context) {
        return context.get(this);
    }
    mold() {
        return `:${this.spelling.description}`;
    }
    form() {
        return new Str(`:${this.spelling.description}`);
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
    static type = normalizeString("set-word!");
    constructor(spelling) {
        super();
        this.spelling = normalize(spelling);
    }
    evaluate(stream, context) {
        let value = stream.next();
        value = value.evaluate(stream, context);
        context.set(this, value);
        return value;
    }
    mold() {
        return `${this.spelling.description}:`;
    }
    form() {
        return new Str(`${this.spelling.description}:`);
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
    static type = normalizeString("lit-word!");
    constructor(spelling) {
        super();
        this.spelling = normalize(spelling);
    }
    evaluate(stream, context) {
        return new Word(this.spelling);
    }
    mold() {
        return `'${this.spelling.description}`;
    }
    form() {
        return new Str(`'${this.spelling.description}`);
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
    static type = normalizeString("datatype!");
    constructor(aClass) {
        super();
        this.value = aClass;
    }

    form() {
        return new Str(`datatype! [ ${this.value.type} ]`);
    }
}

// Nil value
// We don't export this, because it's a singleton, and should be used via `nil`
// That's also why the make method throws an error
class Nil extends Value {
    static type = normalizeString("nil!");
    constructor() {
        super();
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
    form() {
        return new Str(this.type);
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
    "datatype!": new Datatype(Datatype),
    "nil!": new Datatype(Nil),
    "nil": nil,
    "true": new Bool(true),
    "false": new Bool(false),
};
