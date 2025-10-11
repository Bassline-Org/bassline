export class Scalar {}

export class Num extends Scalar {
    constructor(value) {
        super();
        this.value = value;
    }
}

export class Word extends Scalar {
    constructor(value) {
        super();
        this.value = value;
    }

    isSetter() {
        return this.value.endsWith(":");
    }

    isGetter() {
        return this.value.startsWith(":");
    }

    getName() {
        if (this.isSetter()) return this.value.slice(0, -1);
        if (this.isGetter()) return this.value.slice(1);
        return this.value;
    }
}

export class Series {
    constructor(items) {
        this.items = items;
    }

    at(key) {
        return this.items[key];
    }

    length() {
        return this.items.length;
    }
}

export class Tuple extends Series {
    constructor(segments) {
        super(segments);
    }
}

export class Block extends Series {
    constructor(items) {
        super(items);
    }
}
export class Paren extends Block {}

export class Str extends Series {
    constructor(value) {
        super([...value]);
        this.value = value;
    }
}

export class Tag extends Series {
    constructor(raw) {
        const match = raw.match(/<(\w+)(.*)>/);
        const tagName = match[1];
        const attrString = match[2].trim();

        const attrs = {};
        const attrRegex = /(\w+)=["']([^"']+)["']|(\w+)/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrString))) {
            if (attrMatch[1]) {
                // name="value" format
                attrs[attrMatch[1]] = attrMatch[2];
            } else if (attrMatch[3]) {
                // boolean attribute
                attrs[attrMatch[3]] = true;
            }
        }

        super(attrs);
        this.tag = tagName;
        this.raw = raw;
    }
}

export class Url extends Series {
    constructor(value) {
        // Try to parse as full URL with //
        const match = value.match(/^([a-z][a-z0-9+.-]*):\/\/([^\/]+)(\/.*)?$/i);
        if (!match) {
            // Try simple scheme: format (like mailto:)
            const simpleMatch = value.match(/^([a-z][a-z0-9+.-]*):(.*)$/i);
            if (simpleMatch) {
                super({
                    scheme: simpleMatch[1],
                    rest: simpleMatch[2],
                });
            } else {
                super({ value });
            }
        } else {
            super({
                scheme: match[1],
                host: match[2],
                path: match[3] || "/",
            });
        }
        this.value = value;
    }
}

export class Path extends Series {
    constructor(root, refinements) {
        super(refinements);
        this.root = root;
    }

    segments() {
        return [this.root, ...this.items];
    }
}
