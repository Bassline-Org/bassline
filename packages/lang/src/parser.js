export function parse(raw) {
    let pos = 0;
    let source = raw.trim();

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
        next(); // skip opening "
        let value = "";
        while (peek() !== '"') value += next();
        next(); // skip closing "
        return {
            type: "string",
            primitive: true,
            value,
        };
    }

    function parseTag() {
        next(); // skip opening
        let value = "<";
        while (peek() !== ">") {
            value += next();
        }
        value += next(); // include closing >
        return {
            type: "tag",
            value,
        };
    }

    function parseBlock(isParen = false) {
        next(); // skip [
        const items = [];
        while (true) {
            skipWhitespace();
            if (peek() === "]") break;
            items.push(parseValue());
        }
        next();
        return {
            type: isParen ? "paren" : "block",
            items,
        };
    }

    function parseWord() {
        let word = "";
        while (pos < source.length && !/[\s\[\]<>()"]/.test(peek())) {
            word += next();
        }

        // Number
        if (/^-?\d+(\.\d+)?$/.test(word)) {
            return {
                type: "number",
                primitive: true,
                value: Number(word),
            };
        }

        // Tuple (e.g., 1.2.3.4 or 255.0.0)
        if (/^\d+(\.\d+){2,}$/.test(word)) {
            return {
                type: "tuple",
                items: word.split("."),
            };
        }

        // URL (scheme://... pattern)
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(word)) {
            return {
                type: "url",
                value: word,
            };
        }

        // Path (contains / but not a URL)
        if (word.includes("/")) {
            return {
                type: "path",
                items: word.split("/"),
            };
        }

        return {
            type: "word",
            value: word,
        };
    }

    function parseValue() {
        skipWhitespace();
        const char = peek();

        if (char === "(") return parseBlock(true);
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
