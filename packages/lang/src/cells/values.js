export class Value {
    constructor({ value }) {
        this.value = value;
        this.requiresContext = false;
    }
    bind(_context) {
        return this;
    }
    setupContext(_context) {
        return this;
    }
    evaluate() {
        return this;
    }
}

export class Num extends Value {
    type = "num";
}
export class Str extends Value {
    type = "str";
}

export class Block extends Value {
    type = "block";
    forEach(fn) {
        this.value.forEach(fn);
        return this;
    }
    setupContext(context) {
        return this.forEach((cell) => cell.setupContext(context));
    }
    bind(context) {
        return this.forEach((cell) => cell.bind(context));
    }
}

export class Paren extends Block {
    type = "paren";
    evaluate({ stream }) {
        let result;
        this.forEach((cell) => {
            result = cell.evaluate({ stream });
        });
        return result;
    }
}
