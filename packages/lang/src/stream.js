export class Stream {
    constructor(items) {
        this.items = items;
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
