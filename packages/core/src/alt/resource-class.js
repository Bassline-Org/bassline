import { message, isMessage, Message } from "./message.js";
import { DNU as DnuError } from "./errors.js";
import { dnu, selector, isSelector } from "./selector.js";

export class Resource {
    get handlers() {
        if (!this._handlers) {
            this._handlers = new Map()
        }
        return this._handlers
    }

    handlerFor(msg) {
        if (this.handlers.has(msg.selectorString)) {
            return this.handlers.get(msg.selectorString)
        }
    }

    dispatch(msg) {
        if (!isMessage(msg))
            return this.dispatch(message(msg))

        let handler = this.handlerFor(msg);
        if (handler) return msg.execute(handler)
        handler = this.handlerFor(dnu)
        if (handler) {
            return Message.dnu(msg).execute(handler)
        } else {
            throw new Error('No doesNotUnderstand: handler setup! How?!')
        }
    }

    get protocols() {
        return Array.from(this.handlers.keys())
    }

    @select(dnu)
    dnu({ doesNotUnderstand: msg }) {
        throw new DnuError(this, msg)
    }
}

export function select(aSelector) {
    return function (_value, { addInitializer, kind, name }) {
        if (kind === "method") {
            const sel = isSelector(aSelector) ? aSelector.selectorString : selector(aSelector).selectorString
            addInitializer(function () {
                this.handlers.set(sel, this[name].bind(this));
            });
        } else {
            throw new Error('Must use @select decorator on a method!')
        }
    }
}

export class Slot extends Resource {
    constructor(value) {
        super()
        this.value = value
    }
    @select("undefined")
    _get() {
        return this.value
    }

    @select("put:")
    _put({ put: aValue }) {
        this.value = aValue
        return aValue
    }
}


export class Foo extends Resource {
    @select("foo:")
    _foo({ foo }) {
        return foo * 100
    }
}
export class FooBar extends Foo {
    @select("foo:bar:")
    _fooBar({ foo, bar }) {
        return foo * bar
    }
}