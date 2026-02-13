import { Selector } from "./selector.js"

export class Message {
    constructor(aPayload) {
        this.payload = aPayload
    }
    execute(handler) {
        return handler(this.payload)
    }
    get selector() {
        return Selector.fromValue(this.payload)
    }
    get selectorString() {
        return this.selector.selectorString
    }
    static dnu(msg) {
        return new Message({ doesNotUnderstand: msg })
    }
}


export function isMessage(value) {
    return value instanceof Message;
}

export function message(value) {
    if (isMessage(value)) return value;
    return new Message(value)
}