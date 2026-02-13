import { InvalidSelector } from "./errors.js";

export class Selector {
    scalar = null;
    keys = null;
    get value() {
        return this.scalar ?? this.keys
    }

    get selectorString() {
        if (this.scalar) return this.scalar
        return this.keys.map(k => `${k}:`).join('')
    }

    static scalarSelectors = {
        string: 'string',
        number: 'number',
        array: 'array',
        null: 'null',
        empty: 'empty',
        bigint: 'bigint',
        undefined: 'undefined'
    }

    static scalar(str) {
        const s = new Selector();
        s.scalar = str;
        return s
    }

    static keys(...keys) {
        const s = new Selector();
        s.keys = keys;
        return s
    }

    static fromString(aString) {
        const selectorRegex = /(\w+)(?=:)/g
        validateSelector(aString)
        if (!aString.includes(":")) return Selector.scalar(aString)
        const parts = []
        for (const [_, selector] of aString.matchAll(selectorRegex)) {
            parts.push(selector)
        }
        parts.sort()
        if (parts.length === 0) return Selector.scalar('empty')
        return Selector.keys(...parts)
    }

    static fromValue(payload) {
        if (typeof payload !== 'object')
            return Selector.scalar(typeof payload)
        if (Array.isArray(payload))
            return Selector.scalar('array')
        if (payload === null)
            return Selector.scalar('null')

        const keys = Object.keys(payload)
            .filter(key => typeof key === 'string')
        if (keys.length === 0) return Selector.scalar('empty')
        keys.sort()
        return Selector.keys(...keys)
    }
}

function validateSelector(aString) {
    if (typeof aString !== 'string') {
        throw new InvalidSelector(aString, 'Not a string!')
    }
    const multiPart = aString.includes(':')
    if (!multiPart) {
        if (!(aString in Selector.scalarSelectors)) {
            throw new InvalidSelector(aString, 'Not a valid scalar selector! Are you missing a ":"?')
        }
        return true
    }

    if (!aString.endsWith(':')) {
        throw new InvalidSelector(aString, 'Selector contains a ":" character but doesnt end with ":". Did you forget a trailing ":"?')
    }
    return true
}

export function isSelector(value) {
    return value instanceof Selector
}
export function selector(aString) {
    return Selector.fromString(aString)
}

export const dnu = selector('doesNotUnderstand:')