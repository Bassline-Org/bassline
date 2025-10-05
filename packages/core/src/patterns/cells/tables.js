import { Gadget } from "../../gadget.js";

function entries(input) {
    if (input instanceof Object) return Object.entries(input);
    if (Array.isArray(input) && input.length === 2) {
        return [[input[0], input[1]]];
    }
    if (input instanceof Map) return input.entries();
    return [];
}

function firstTableStep(current, incoming) {
    const additions = [];
    for (const [key, value] of entries(incoming)) {
        if (current[key] === undefined) {
            additions.push([key, value]);
        }
    }
    const merged = Object.fromEntries(entries(current).concat(additions));
    this.update(merged);
    this.added?.(Object.fromEntries(additions));
}

function firstTable(initial, onAdded) {
    const cell = new Gadget(firstTableStep, initial);
    cell.added = onAdded || function (additions) {
        console.log("added", additions);
    };
    return cell;
}

const a = firstTable({
    a: 1,
    b: 2,
    c: 3,
});

a.receive({
    b: 5,
    d: 6,
});

console.log(a.current());
