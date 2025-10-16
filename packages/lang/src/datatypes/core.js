import { normalize, Stream } from "../utils.js";

export class Value {}

export class Word extends Value {
    constructor(spelling) {
        super();
        this.spelling = normalize(spelling);
    }
    mold() {
        return this.spelling.description;
    }
}
export class GetWord extends Word {
    mold() {
        return `:${this.spelling.description}`;
    }
}
export class SetWord extends Word {
    mold() {
        return `${this.spelling.description}:`;
    }
}
export class LitWord extends Word {
    mold() {
        return `'${this.spelling.description}`;
    }
}

export class Compound extends Value {
    constructor(items) {
        super();
        this.items = items;
    }
    stream() {
        return new Stream(this.items);
    }
    mold() {
        return `[${
            this.items.map((e) => e instanceof Value ? e.mold() : e).join(" ")
        }]`;
    }
}

export class Block extends Compound {}
export class Paren extends Compound {
    mold() {
        return `(${
            this.items.map((e) => e instanceof Value ? e.mold() : e).join(" ")
        })`;
    }
}
