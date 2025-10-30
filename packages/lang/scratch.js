function iota(n) {
    if (typeof n === "number") {
        return Array.from({ length: n }, (_, i) => i);
    }
    if (Array.isArray(n)) {
        if (n.length === 1) {
            return Array.from({ length: n[0] }, (_, i) => i);
        }
        const [dim, ...rest] = n;
        return Array.from({ length: dim }, (_, i) => iota(rest));
    }
}

function shape(fill, dims) {
    if (dims.length === 1) {
        return Array.from({ length: dims[0] }, (_, i) => fill);
    }
    const [dim, ...rest] = dims;
    return Array.from({ length: dim }, (_, i) => shape(fill, rest));
}

//console.log(shape("hello", [3, 2]));
//console.log(shape("foo", [3, 3, 3]));
