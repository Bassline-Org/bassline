export class Stream {
    constructor(items) {
        this.items = items;
        this.pos = 0;
    }

    peek(k = 0) {
        return this.items[this.pos + k];
    }
    next() {
        if (this.pos >= this.items.length) {
            console.error(
                `Unexpected end of input! ${this.items} ${this.pos}`,
            );
            throw new Error("eoi");
        }
        return this.items[this.pos++];
    }
    isAtEnd() {
        return this.pos >= this.items.length;
    }

    mark() {
        return this.pos;
    }
    restore(m) {
        this.pos = m;
    }

    take(n) {
        if (this.pos + n > this.items.length) {
            throw new Error("not enough tokens");
        }
        const slice = this.items.slice(this.pos, this.pos + n);
        this.pos += n;
        return slice;
    }

    consumeWhile(pred) {
        const start = this.pos;
        while (!this.isAtEnd() && pred(this.peek())) this.pos++;
        return this.items.slice(start, this.pos);
    }
}
