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
        if (this[key]) {
            return this[key];
        }
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
    constructor(tagName, attrs) {
        super(attrs);
        this.tagName = tagName;
    }
}

export class Url extends Series {
    constructor(value, components) {
        super(components);
        this.value = value;
    }
}

export class Path extends Series {}

export class File extends Scalar {
    constructor(path) {
        super(path);
        this.path = path;
    }

    toString() {
        return `%${this.path}`;
    }
}
