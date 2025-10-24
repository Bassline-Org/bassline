import { normalize } from "../../utils.js";
import * as t from "./types.js";
const { TYPES, FUNCTION_TYPES } = t;

export class Value {
    constructor(value) {
        this.value = value;
    }
    evaluate(context, iter) {
        return this;
    }
    getType() {
        return new Word(this.type);
    }
    to(type) {
        if (this.type !== type) {
            throw new Error(
                `Cannot convert ${this.type.description} to ${type.description}`,
            );
        }
        return this;
    }
    form() {
        return new Str(this.value);
    }
    mold() {
        return new Str(this.value);
    }
    doc(doc) {
        const docString = doc.to("STRING!");
        this.documentation = docString;
    }
    is(type) {
        if (type instanceof Value) {
            return this.type === type.type;
        }
        return this.type === type;
    }
    describe() {
        return this.documentation ?? unset;
    }
    equals(other) {
        const otherValue = other.to(this.type);
        return new Bool(this.value === otherValue.value);
    }
    cast(datatype) {
        const type = datatype.value.type;
        return this.to(type);
    }
    static make(context, iter) {
        throw new Error(
            "Unknown make! method for type: ${this.type.description}",
        );
    }

    static typed(type) {
        return class extends this {
            constructor(value) {
                super(value);
                this.type = type;
            }
        };
    }
}
export class Bool extends Value.typed(TYPES.bool) {
    to(type) {
        if (type === TYPES.bool) return new Num(this.value ? 1 : 0);
        return super.to(type);
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
    iter() {
        return this.items.values();
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
    fold(fn, initial, context) {
        let acc = initial;
        const iter = this.iter();
        for (const item of iter) {
            const fIter = [acc, item].values();
            acc = fn.evaluate(context, fIter);
        }
        return acc;
    }
    slice(start, end) {
        const startValue = start.to("number!");
        const endValue = end.to("number!");
        return new this.constructor(
            this.items.slice(startValue.value, endValue.value),
        );
    }
    fold(fn, initial, context) {
        let acc = initial;
        const iter = this.iter();
        const blockItems = [];
        const block = new Block(blockItems);
        for (const item of iter) {
            block.items = [fn, acc, item];
            acc = block.doBlock(context);
        }
        return acc;
    }
    length() {
        return new Num(this.items.length);
    }
    get(index) {
        const indexValue = index.to(this.keyType);
        return this.items[indexValue.value];
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
        return new Str(`"${this.value}"`);
    }
    static make(context, iter) {
        const value = iter.next().value.evaluate(context, iter);
        return new Str(value.form().value);
    }
}

export class Block extends Series.typed(TYPES.block) {
    /**
     * Reduce will evaluate each item in the block, and return a new block with the results
     * It will not deeply evaluate
     * @param {*} stream
     * @param {*} context
     * @returns
     */
    reduce(context) {
        const iter = this.iter();
        const result = [];
        for (const item of iter) {
            result.push(item.evaluate(context, iter));
        }
        return new Block(result);
    }
    /**
     * Compose will evaluate paren items, and recursively compose blocks
     * This is useful for dynamically generating code
     * @returns {Block} - A new block with the paren items evaluated, and blocks composed
     */
    compose(context) {
        const iter = this.iter();
        const result = [];
        for (const item of iter) {
            if (item instanceof Paren) {
                result.push(item.doBlock(context));
                continue;
            }
            if (item instanceof Block) {
                result.push(item.compose(context));
                continue;
            }
            result.push(item);
        }
        return new Block(result);
    }
    doBlock(context) {
        const iter = this.iter();
        let result = null;
        for (const item of iter) {
            result = item.evaluate(context, iter);
        }
        if (!result) {
            throw new Error("No result from doBlock");
        }
        return result;
    }

    mold() {
        const items = this.items.map((e) => `${e.mold().value}`);
        return new Str(`[ ${items.join(" ")} ]`);
    }
    static make(stream, context) {
        const value = iter.next().value.evaluate(context, iter);
        return new this.constructor([value]);
    }
}

export class Paren extends Block.typed(TYPES.paren) {
    mold() {
        const items = this.items.map((e) => `${e.mold().value}`);
        return new Str(`(${items.join(" ")})`);
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
    evaluate(context, iter) {
        return (context.get(this)).evaluate(context, iter);
    }
    mold() {
        return new Str(this.spelling.description);
    }
    form() {
        return new Str(this.spelling.description);
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
        return super.to(type);
    }
}
/**
 * Get word is similar to {Word}, however if the value is a function, it will not execute it,
 */
export class GetWord extends WordLike.typed(TYPES.getWord) {
    evaluate(context, _iter) {
        const bound = context.get(this);
        if (FUNCTION_TYPES.has(bound.type)) {
            return bound;
        }
        return bound.evaluate(context, _iter);
    }
    mold() {
        return new Str(`:${this.spelling.description}`);
    }
    form() {
        return new Str(`:${this.spelling.description}`);
    }
}

/**
 * Set word will set the value for the spelling in the context
 */
export class SetWord extends WordLike.typed(TYPES.setWord) {
    evaluate(context, iter) {
        const value = iter.next().value.evaluate(context, iter);
        context.set(this, value);
        return value;
    }
    mold() {
        return new Str(`${this.spelling.description}:`);
    }
    form() {
        return new Str(`${this.spelling.description}:`);
    }
}
/**
 * Lit word when evaluated, will return a {Word} value, with the spelling of the literal word
 */
export class LitWord extends WordLike.typed(TYPES.litWord) {
    static type = TYPES.litWord;
    // evaluate(stream, context) {
    //     return new Word(this.spelling);
    // }
    mold() {
        return new Str(`'${this.spelling.description}`);
    }
    form() {
        return new Str(`'${this.spelling.description}`);
    }
}

// Datatype is a type that represents a class of values
// It is only used via `make` to create a new basic instance of that type
// As well as for type checking, since type? returns a datatype! value
// And we can compare them using eq?
export class Datatype extends Value.typed(TYPES.datatype) {
    mold() {
        return new Str(this.value.type.description);
    }
    form() {
        return new Str(`datatype! [ ${this.value.type.description} ]`);
    }
}

export class Condition extends Value.typed(TYPES.condition) {
    static make(condition) {
        return new Condition(condition.to(TYPES.litWord).spelling);
    }
    evaluate(context, iter) {
        return new Restart(this, context, iter);
    }
}

export class Restart extends Value.typed(TYPES.restart) {
    constructor(condition, context, iter) {
        super({
            condition,
            context,
            continuation: new Block(iter.toArray()),
        });
    }
    get condition() {
        return this.value.condition;
    }
    get context() {
        return this.value.context;
    }
    get continuation() {
        return this.value.continuation;
    }
    resume() {
        return this.continuation.doBlock(this.context);
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
    "series!": new Datatype(Series),
    "string!": new Datatype(Str),
    "word!": new Datatype(Word),
    "get-word!": new Datatype(GetWord),
    "set-word!": new Datatype(SetWord),
    "lit-word!": new Datatype(LitWord),
    "block!": new Datatype(Block),
    "paren!": new Datatype(Paren),
    "datatype!": new Datatype(Datatype),
    "char!": new Datatype(Char),
    "true": new Bool(true),
    "false": new Bool(false),
    "condition!": new Datatype(Condition),
    "restart!": new Datatype(Restart),
};
