import { gadgetProto } from "./gadget.js";

export function isGadget(obj) {
    return gadgetProto.isPrototypeOf(obj);
}

export function pick(obj, keys) {
    const picked = {};
    if (typeof obj !== "object" || obj === null) return picked;
    for (const key of keys) {
        if (obj[key] !== undefined) {
            picked[key] = obj[key];
        }
    }
    return picked;
}

export function isNil(obj) {
    return obj === undefined || obj === null;
}

export function isNotNil(obj) {
    return !isNil(obj);
}

export function isString(obj) {
    return typeof obj === "string";
}

export function isNumber(obj) {
    return typeof obj === "number";
}

export function isBoolean(obj) {
    return typeof obj === "boolean";
}

export function isFunction(obj) {
    return typeof obj === "function";
}

export function isArray(obj) {
    return Array.isArray(obj);
}
