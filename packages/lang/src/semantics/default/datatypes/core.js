import { normalize } from "../../../utils.js";
import * as t from "./types.js";
const { TYPES, FUNCTION_TYPES } = t;

export class Value {
    constructor(value) {
        this.value = value;
    }
    // Removed evaluate() and getType() - dialects handle evaluation
    to(type) {
        if (this.type !== type) {
            console.error(
                "Cannot convert ",
                this.type,
                " to ",
                type,
            );
            throw new Error(
                `Cannot convert ${this} to ${type}`,
            );
        }
        return this;
    }
    form() {
        return new Str(this.value);
    }
    mold() {
        console.error("Cannot mold a this value!", this);
        throw new Error("Cannot mold a this value!");
    }
    doc(doc) {
        const docString = doc.to(TYPES.string);
        this.documentation = docString;
        return doc;
    }
    is(type) {
        if (type instanceof Value) {
            return this.type === type.type;
        }
        return this.type === type;
    }
    describe() {
        return this.documentation ?? new Str("No documentation available");
    }
    equals(other) {
        const otherValue = other.to(this.type);
        return new Bool(this.value === otherValue.value);
    }
    cast(datatype) {
        const type = datatype.value.type;
        return this.to(type);
    }
    static make(ev) {
        throw new Error(
            "Unknown make! method for type: ${this.type.description}",
        );
    }
    static typed(type) {
        return class extends this {
            static type = type;
            constructor(value) {
                super(value);
                this.type = type;
            }
        };
    }
}

export class Bool extends Value.typed(TYPES.bool) {
    to(type) {
        if (type === TYPES.number) return new Num(this.value ? 1 : 0);
        if (type === TYPES.word) return new Word(this.value ? "true" : "false");
        if (type === TYPES.litWord) {
            return new LitWord(this.value ? "true" : "false");
        }
        if (type === TYPES.getWord) {
            return new GetWord(this.value ? "true" : "false");
        }
        if (type === TYPES.setWord) {
            return new SetWord(this.value ? "true" : "false");
        }
        return super.to(type);
    }
    mold() {
        return this.value.toString();
    }
}
export class Num extends Value.typed(TYPES.number) {
    to(type) {
        if (type === TYPES.string) return new Str(String(this.value));
        return super.to(type);
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
    modulo(other) {
        const otherValue = other.to(this.type);
        return new Num(this.value % otherValue.value);
    }
    gt(other) {
        const otherValue = other.to(this.type);
        return new Bool(this.value > otherValue.value);
    }
    lt(other) {
        const otherValue = other.to(this.type);
        return new Bool(this.value < otherValue.value);
    }
    gte(other) {
        const otherValue = other.to(this.type);
        return new Bool(this.value >= otherValue.value);
    }
    lte(other) {
        const otherValue = other.to(this.type);
        return new Bool(this.value <= otherValue.value);
    }
    mold() {
        return this.value.toString();
    }
}

export class Series extends Value.typed(TYPES.series) {
    constructor(items = []) {
        super(items);
    }
    get keyType() {
        return TYPES.number;
    }
    get items() {
        return this.value;
    }
    set items(items) {
        this.value = items;
        return this;
    }
    chunk(chunkSize) {
        const size = chunkSize.to(TYPES.number).value;
        const chunks = [];
        for (let i = 0; i < this.items.length; i += size) {
            chunks.push(this.items.slice(i, i + size));
        }
        return new this.constructor(chunks);
    }
    equals(other) {
        const otherValue = other.to(this.type);
        if (this.items.length !== otherValue.items.length) {
            return new Bool(false);
        }
        return new Bool(
            this.items.every((item, index) =>
                (item instanceof Value)
                    ? item.equals(otherValue.items[index])
                    : item === otherValue.items[index]
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
        const indexValue = index.to(this.keyType);
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
    slice(start, end) {
        const startValue = start.to(TYPES.number);
        const endValue = end.to(TYPES.number);
        return new this.constructor(
            this.items.slice(startValue.value, endValue.value),
        );
    }
    // Removed fold() - use fold action from semantics/default/actions.js instead
    length() {
        return new Num(this.items.length);
    }
    get(index) {
        const indexValue = index.to(this.keyType);
        return this.items[indexValue.value];
    }
    unique() {
        const uniqueItems = new Set();
        return new this.constructor(Array.from(uniqueItems));
    }
    pick(index) {
        const indexValue = index.to(this.keyType);
        const value = this.get(indexValue);
        if (!value) {
            throw new Error(
                `Index ${indexValue.value} out of bounds for series: ${this.type.description}`,
            );
        }
        return value;
    }
}

export class Char extends Value.typed(TYPES.char) {
    constructor(value) {
        super(value);
    }
    to(type) {
        if (type === TYPES.string) return new Str(this.value);
        return super.to(type);
    }
    form() {
        return new Str(this.value);
    }
    mold() {
        return this.value;
    }
    toString() {
        return this.value;
    }
}

export class Str extends Series.typed(TYPES.string) {
    get items() {
        return Array.from(this.value).map((char) => new Char(char));
    }
    to(type) {
        if (type === TYPES.number) {
            return new Num(Number(this.value));
        }
        if (type === TYPES.word) {
            return new Word(this.value);
        }
        if (type === TYPES.setWord) {
            return new SetWord(this.value);
        }
        if (type === TYPES.getWord) {
            return new GetWord(this.value);
        }
        if (type === TYPES.litWord) {
            return new LitWord(this.value);
        }
        return super.to(type);
    }
    form() {
        return this;
    }
    mold() {
        if (Array.isArray(this.value)) {
            return `"${this.value.map((e) => e.toString()).join("")}"`;
        }
        return `"${this.value}"`;
    }
    static make(val) {
        return new Str(val.form().value);
    }
}

export class Block extends Series.typed(TYPES.block) {
    // Removed reduce() - use evaluateBlock() from semantics/default/evaluate.js instead
    // Removed compose() - use composeBlock() from semantics/default/evaluate.js instead
    // Removed doBlock() - use evaluateBlock() from semantics/default/evaluate.js instead
    mold() {
        const items = this.items.map((e) => e.mold()).join(" ");
        return `[ ${items} ]`;
    }
}

export class Paren extends Block.typed(TYPES.paren) {
    // Removed evaluate() - dialects handle paren evaluation
    mold() {
        const items = this.items.map((e) => e.mold()).join(" ");
        return `(${items})`;
    }
}

export class WordLike extends Value.typed(normalize("any-word!")) {
    constructor(spelling) {
        if (typeof spelling === "string") {
            super(normalize(spelling));
            return this;
        }
        if (typeof spelling === "symbol") {
            super(spelling);
            return this;
        }
        if (spelling instanceof WordLike) {
            super(spelling.spelling);
            return this;
        }
        console.error("Invalid spelling: ", spelling);
        console.log("Type: ", typeof spelling);
        throw new Error(`Invalid spelling!`);
    }
    get spelling() {
        return this.value;
    }
    to(type) {
        if (type === TYPES.string) {
            return new Str(this.spelling.description);
        }
        if (type === TYPES.litWord) {
            return new LitWord(this.spelling);
        }
        if (type === TYPES.getWord) {
            return new GetWord(this.spelling);
        }
        if (type === TYPES.setWord) {
            return new SetWord(this.spelling);
        }
        if (type === TYPES.word) {
            return new Word(this.spelling);
        }
        return super.to(type);
    }
    equals(other) {
        const otherValue = other.to(this.type);
        return (this.spelling === otherValue.spelling)
            ? new Word("true")
            : new Word("false");
    }
    static make(spelling, context, iter) {
        return new this.constructor(spelling);
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
export class Word extends WordLike.typed(TYPES.word) {
    // Removed evaluate() - dialects handle word evaluation
    mold() {
        return new Str(this.spelling.description);
    }
    form() {
        return new Str(this.spelling.description);
    }
    mold() {
        return this.spelling.description;
    }
}
/**
 * Get word is similar to {Word}, however if the value is a function, it will not execute it,
 */
export class GetWord extends WordLike.typed(TYPES.getWord) {
    // Removed evaluate() - dialects handle get-word evaluation
    form() {
        return new Str(`:${this.spelling.description}`);
    }
    mold() {
        return `:${this.spelling.description}`;
    }
}

/**
 * Set word will set the value for the spelling in the context
 */
export class SetWord extends WordLike.typed(TYPES.setWord) {
    // Removed evaluate() - dialects handle set-word evaluation
    form() {
        return new Str(`${this.spelling.description}:`);
    }
    mold() {
        return `${this.spelling.description}:`;
    }
}

/**
 * Lit word when evaluated, will return a {Word} value, with the spelling of the literal word
 */
export class LitWord extends WordLike.typed(TYPES.litWord) {
    // Removed evaluate() - dialects handle lit-word evaluation
    form() {
        return new Str(`'${this.spelling.description}`);
    }
    mold() {
        return `'${this.spelling.description}`;
    }
}

// Datatype is a type that represents a class of values
// It is only used via `make` to create a new basic instance of that type
// As well as for type checking, since type? returns a datatype! value
// And we can compare them using eq?
export class Datatype extends Value.typed(TYPES.datatype) {
    mold() {
        return this.value.type.description;
    }
    form() {
        return new Str(`datatype! [ ${this.value.type.description} ]`);
    }
    toString() {
        return this.value.type.description;
    }
}

export const number = (value) => new Num(value);
export const string = (value) => new Str(value);
export const block = (value) => new Block(value);
export const paren = (value) => new Paren(value);
export const word = (value) => new Word(value);
export const getWord = (value) => new GetWord(value);
export const setWord = (value) => new SetWord(value);
export const litWord = (value) => new LitWord(value);
export const datatype = (value) => new Datatype(value);
export const char = (value) => new Char(value);

export default {
    "number!": new Datatype(Num),
    "string!": new Datatype(Str),
    "word!": new Datatype(Word),
    "get-word!": new Datatype(GetWord),
    "set-word!": new Datatype(SetWord),
    "lit-word!": new Datatype(LitWord),
    "block!": new Datatype(Block),
    "paren!": new Datatype(Paren),
    "datatype!": new Datatype(Datatype),
    "char!": new Datatype(Char),
    "bool!": new Datatype(Bool),
    "true": new Bool(true),
    "false": new Bool(false),
};
