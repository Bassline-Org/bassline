export class Scalar {
    constructor(value) {
        this.value = value;
    }
}

export class Num extends Scalar {}

export class Word extends Scalar {
    isSetter() {
        return this.value.endsWith(":");
    }

    isGetter() {
        return this.value.startsWith(":");
    }
    isQuoted() {
        return this.value.startsWith("'");
    }

    getName() {
        if (this.isSetter()) return this.value.slice(0, -1);
        if (this.isGetter() || this.isQuoted()) return this.value.slice(1);
        return this.value;
    }
}

export class Series {
    constructor(items) {
        this.items = items;
    }

    get first() {
        return this.items[0];
    }

    get rest() {
        return this.items.slice(1);
    }

    get(key) {
        return this.items[key];
    }

    get length() {
        return this.items.length;
    }
}

export class Tuple extends Series {}

export class Block extends Series {}
export class Paren extends Block {}

export class Str extends Series {
    constructor(value) {
        super(value);
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
        const match = value.match(/^([a-z][a-z0-9+.-]*):\/\/([^\/]+)(\/.*)?$/i);
        if (!match) {
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

export class Path extends Series {}
