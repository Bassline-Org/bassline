export class Stream {
    constructor(items, context) {
        this.items = items;
        this.context = context;
        this.pos = 0;
    }

    peek() {
        return this.items[this.pos];
    }

    next() {
        const value = this.items[this.pos];
        this.pos = this.pos + 1;
        return value;
    }

    isAtEnd() {
        return this.pos >= this.items.length - 1;
    }
}
