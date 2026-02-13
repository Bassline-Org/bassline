export class DNU extends Error {
    constructor(resource, msg) {
        console.error("resource: ", resource, " message: ", msg)
        super(`Message not understood!`)
    }
}
export class KeyNotFound extends Error {
    constructor(resource, key) {
        console.error("resource: ", resource, " key: ", key)
        super(`Key not found in Collection!`)
    }
}
export class InvalidSelector extends Error {
    constructor(selector, msg = '') {
        console.error(selector, "! \n", msg)
        super('Invalid Selector!')
    }
}