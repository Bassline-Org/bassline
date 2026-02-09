export class DNU extends Error {
    constructor(resource, msg) {
        super(`Resource: ${resource} does not understand ${msg}`)
    }
}
export class KeyNotFound extends Error {
    constructor(resource, key) {
        super(`Key not found in Collection: ${resource} key: ${key}`)
    }
}