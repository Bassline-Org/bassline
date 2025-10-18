export function normalize(str) {
    if (typeof str === "symbol") {
        return Symbol.for(normalizeString(str.description));
    }
    return Symbol.for(normalizeString(str));
}
export function normalizeString(str) {
    return str.trim().toUpperCase();
}
