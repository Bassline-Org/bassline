export class MissingContext extends Error {
    constructor(word) {
        super(`${word.spelling} has no context!`);
    }
}

export class AnyWord {
    constructor({ spelling, context }) {
        this.spelling = spelling;
        this.context = context;
        this.requiresContext = true;
    }
    assertContext() {
        if (!this.context) {
            throw new MissingContext(this);
        }
    }
    setupContext(context) {
        if (!this.context) {
            this.context = context;
        }
        return this;
    }
    bind(knownWord) {
        const context = knownWord.context;
        const contextValue = context.get(this.spelling);
        if (contextValue) {
            return new this.constructor({ spelling: this.spelling, context });
        }
        return this;
    }
    lookup() {
        this.assertContext();
        return this.context.get(this.spelling);
    }
    set(newValue) {
        this.assertContext();
        this.context.set(this.spelling, newValue);
    }
}

export class GetWord extends AnyWord {
    evaluate({ stream }) {
        this.assertContext();
        return this.lookup();
    }
}

export class SetWord extends AnyWord {
    evaluate({ stream }) {
        this.assertContext();
        const value = stream.next().evaluate({ stream });
        this.set(value);
        return value;
    }
}

export class LitWord extends AnyWord {
    evaluate({ stream }) {
        this.assertContext();
        return new Word({ spelling: this.spelling, context: this.context });
    }
}

export class Word extends AnyWord {
    evaluate({ stream }) {
        this.assertContext();
        const value = this.lookup();
        return value.evaluate({ stream });
    }
}
