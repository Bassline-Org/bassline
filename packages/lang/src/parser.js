import {
    Block,
    File,
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
        // Skip comments (;... until end of line)
        if (peek() === ';') {
            while (pos < source.length && peek() !== '\n') pos++;
            if (peek() === '\n') pos++; // Skip newline
            skipWhitespace(); // Continue skipping whitespace after comment
        }
    }

    function isWhitespace(char) {
        return /\s/.test(char);
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
            if (pos >= source.length) {
                throw new Error("Unclosed parenthesis - reached end of input");
            }
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

    // In parser.js
    function parseTag() {
        let start = pos;
        next(); // skip

        // Parse tag name
        let tagName = "";
        while (peek() !== ">" && peek() !== " " && !isWhitespace(peek())) {
            tagName += next();
        }

        skipWhitespace();

        // Parse attributes
        const attrs = {};
        while (peek() !== ">") {
            skipWhitespace();
            if (peek() === ">") break;

            // Attribute name
            let attrName = "";
            while (peek() !== "=" && peek() !== ">" && !isWhitespace(peek())) {
                attrName += next();
            }

            skipWhitespace();

            if (peek() === "=") {
                next(); // skip =
                skipWhitespace();
                const quote = next(); // " or '
                let attrValue = "";
                while (peek() !== quote) {
                    attrValue += next();
                }
                next(); // skip closing quote
                attrs[attrName] = attrValue;
            } else {
                // Boolean attribute
                attrs[attrName] = true;
            }
        }

        next(); // skip >
        const stop = pos;

        const t = new Tag(tagName, attrs);
        t.start = start;
        t.stop = stop;
        return t;
    }

    function parseUrl(word) {
        while (pos < source.length && !/[\s\[\]<>()"]/.test(peek())) {
            word += next();
        }

        // Parse URL components here
        const fullMatch = word.match(
            /^([a-z][a-z0-9+.-]*):\/\/([^\/]+)(\/.*)?$/i,
        );

        let components;
        if (fullMatch) {
            components = {
                scheme: fullMatch[1],
                host: fullMatch[2],
                path: fullMatch[3] || "/",
            };
        } else {
            const simpleMatch = word.match(/^([a-z][a-z0-9+.-]*):(.*)$/i);
            if (simpleMatch) {
                components = {
                    scheme: simpleMatch[1],
                    rest: simpleMatch[2],
                };
            } else {
                throw new Error(`Invalid URL at position ${start}`);
            }
        }

        return new Url(word, components);
    }

    function parseWord() {
        let word = "";
        const start = pos;
        while (pos < source.length && !/[\s\[\]<>()"]/.test(peek())) {
            word += next();
        }
        const stop = pos;

        // If we didn't consume anything, we have an unexpected character
        if (word === "") {
            throw new Error(`Unexpected character at position ${pos}: '${peek()}'`);
        }

        // Number (integer or decimal)
        if (/^-?\d+(\.\d+)?$/.test(word)) {
            const num = new Num(parseFloat(word));
            num.start = start;
            num.stop = stop;
            return num;
        }

        // Tuple (3+ segments: 1.2.3.4 or 255.0.0)
        if (/^\d+(\.\d+){2,}$/.test(word)) {
            const segments = word.split(".").map((s) => parseInt(s));

            validateTuple(segments);

            const tup = new Tuple(segments);
            tup.start = start;
            tup.stop = stop;
            return tup;
        }

        // URL (any scheme:// or scheme: pattern)
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(word)) {
            const url = parseUrl(word);
            url.start = start;
            url.stop = stop;
            return url;
        }

        if (word.includes("/") && word.length > 1) {
            const segments = word.split("/");
            const root = new Word(segments[0]);
            const refinements = segments.slice(1).map((s) => new Word(s));
            const path = new Path([root, ...refinements]);
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

    function parseFile() {
        const start = pos;
        next(); // skip %

        // Check for quoted file path
        if (peek() === '"') {
            next(); // skip opening quote
            let path = "";
            while (peek() !== '"') {
                if (peek() === "\\") {
                    next(); // skip escape
                    const escaped = next();
                    if (escaped === "n") path += "\n";
                    else if (escaped === "t") path += "\t";
                    else if (escaped === "r") path += "\r";
                    else path += escaped;
                } else {
                    path += next();
                }
            }
            next(); // skip closing quote
            const stop = pos;
            const f = new File(path);
            f.start = start;
            f.stop = stop;
            return f;
        }

        // Unquoted file path
        let path = "";
        while (pos < source.length && !/[\s\[\]<>()"]/.test(peek())) {
            path += next();
        }
        const stop = pos;
        const f = new File(path);
        f.start = start;
        f.stop = stop;
        return f;
    }

    function parseValue() {
        skipWhitespace();
        const char = peek();

        if (char === "(") return parseParen();
        if (char === "[") return parseBlock();
        if (char === '"') return parseString();
        if (char === "%") return parseFile();

        // Handle < and > as operators (words), not tags
        if (char === "<" || char === ">") {
            const start = pos;
            const op = next();
            const stop = pos;
            const w = new Word(op);
            w.start = start;
            w.stop = stop;
            return w;
        }

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

function validateTuple(segments) {
    // Must have 3-10 segments
    if (segments.length < 3 || segments.length > 10) {
        throw new Error(
            `Tuple must have 3-10 segments, got ${segments.length}`,
        );
    }

    // Each segment must be 0-255 (8-bit unsigned)
    for (const seg of segments) {
        if (!Number.isInteger(seg) || seg < 0 || seg > 255) {
            throw new Error(
                `Tuple segment must be integer 0-255, got ${seg}`,
            );
        }
    }
}
