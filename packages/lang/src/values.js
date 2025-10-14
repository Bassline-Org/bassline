import { isa, normalize, Stream } from "./utils.js";

export class Value {}

export class Scalar extends Value {
    constructor(value) {
        super();
        this.value = value;
    }
    toJSON() {
        return this.value;
    }
}
export class Num extends Scalar {}
export class Str extends Scalar {}

export class Word extends Value {
    constructor(spelling) {
        super();
        this.spelling = normalize(spelling);
    }
    toJSON() {
        return this.spelling.description;
    }
}
export class SetWord extends Word {
    toJSON() {
        return `${this.spelling.description}:`;
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
    toJSON() {
        const arr = [this.constructor.name.toUpperCase()];
        this.items.forEach((e) => arr.push(e.toJSON()));
        return arr;
    }
}

export class Block extends Compound {}
export class Paren extends Compound {}
