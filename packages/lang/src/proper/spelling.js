export function normalize(str) {
    if (typeof str === "symbol") return str;
    return Symbol.for(str.trim().toUpperCase());
}
