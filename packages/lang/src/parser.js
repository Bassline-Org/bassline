import {
    Block,
    Num,
    Paren,
    Path,
    Str,
    Tag,
    Tuple,
    Url,
    Word,
} from "./nodes.js";

export function parse(source) {
    let pos = 0;

    function peek() {
        return source[pos];
    }

    function next() {
        return source[pos++];
    }

    function skipWhitespace() {
        while (pos < source.length && /\s/.test(peek())) pos++;
    }

    function parseString() {
        let start = pos;
        next(); // skip opening "
        let value = "";
        while (peek() !== '"') {
            if (peek() === "\\") {
                next(); // skip escape
                const escaped = next();
                // Handle escape sequences
                if (escaped === "n") value += "\n";
                else if (escaped === "t") value += "\t";
                else if (escaped === "r") value += "\r";
                else value += escaped;
            } else {
                value += next();
            }
        }
        next(); // skip closing "
        const stop = pos;
        const s = new Str(value);
        s.start = start;
        s.stop = stop;
        return s;
    }

    function parseTag() {
        let start = pos;
        let value = "";
        while (peek() !== ">") {
            value += next();
        }
        value += next(); // include closing >
        stop = pos;
        const t = new Tag(value);
        t.start = start;
        t.stop = stop;
    }

    function parseBlock() {
        const start = pos;
        next(); // skip [
        const items = [];
        while (true) {
            skipWhitespace();
            if (peek() === "]") break;
            items.push(parseValue());
        }
        next(); // skip ]
        const stop = pos;
        const b = new Block(items);
        b.start = start;
        b.stop = stop;
        return b;
    }

    function parseParen() {
        const start = pos;
        next(); // skip (
        const items = [];
        while (true) {
            skipWhitespace();
            if (peek() === ")") break;
            items.push(parseValue());
        }
        next(); // skip )
        const stop = pos;
        const b = new Paren(items);
        b.start = start;
        b.stop = stop;
        return b;
    }

    function parseWord() {
        let word = "";
        const start = pos;
        while (pos < source.length && !/[\s\[\]<>()"]/.test(peek())) {
            word += next();
        }
        const stop = pos;

        // Number (integer or decimal)
        if (/^-?\d+(\.\d+)?$/.test(word)) {
            const num = new Num(parseFloat(word));
            num.start = start;
            num.stop = stop;
            return num;
        }

        // Tuple (e.g., 1.2.3.4 or 255.0.0)
        if (/^\d+(\.\d+){2,}$/.test(word)) {
            const tup = new Tuple(word.split(".").map((s) => parseInt(s)));
            tup.start = start;
            tup.stop = stop;
            return tup;
        }

        // URL (any scheme:// or scheme: pattern)
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(word)) {
            const url = new Url(word);
            url.start = start;
            url.stop = stop;
            return url;
        }

        // Path (contains / but not a URL)
        if (word.includes("/") && word.length > 1) {
            const segments = word.split("/");
            const path = new Path(segments[0], segments.slice(1));
            path.start = start;
            path.stop = stop;
            return path;
        }

        // Word
        const wordNode = new Word(word);
        wordNode.start = start;
        wordNode.stop = stop;
        return wordNode;
    }

    function parseValue() {
        skipWhitespace();
        const char = peek();

        if (char === "(") return parseParen();
        if (char === "[") return parseBlock();
        if (char === '"') return parseString();
        if (char === "<") return parseTag();
        return parseWord();
    }

    const values = [];
    while (pos < source.length) {
        skipWhitespace();
        if (pos >= source.length) break;
        values.push(parseValue());
    }

    return values;
}
