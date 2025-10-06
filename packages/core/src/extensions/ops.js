/// Defines operations for the system
/// We use these instead of passing explicit functions when building function gadgets
/// They are categorized into 3 types:
/// 1. ops.unary - a function that takes a single argument, and immediately returns the result
/// 2. ops.named - a function that takes argument and knows what keys it requires to compute the result. IE fixed named arguments
/// 3. ops.varargs - a function that takes an arbitrary map of arguments, and computes the result incrementally IE things like sum, average etc

import { bl } from "../index.js";
bl();

function unary({ name, fn, override = false }) {
    if (bl().ops.unary[name] !== undefined && !override) {
        console.log(`Op ${name} already defined`);
        console.log("Use override = true to overwrite this entry!");
        return;
    }
    function entry(...args) {
        return this.fn(...args);
    }
    entry.type = "unary";
    entry.name = name;
    entry.fn = fn;
    bl().ops.unary[name] = entry;
}

function named({ name, fn, requiredKeys, override = false }) {
    if (bl().ops.named[name] !== undefined && !override) {
        console.log(`Op ${name} already defined`);
        console.log("Use override = true to overwrite this entry!");
        return;
    }
    function entry(...args) {
        return this.fn(...args);
    }
    entry.type = "named";
    entry.name = name;
    entry.fn = fn;
    entry.requiredKeys = requiredKeys;
    bl().ops.named[name] = entry;
}

function varargs({ name, fn, override = false }) {
    if (bl().ops.varargs[name] !== undefined && !override) {
        console.log(`Op ${name} already defined`);
        console.log("Use override = true to overwrite this entry!");
        return;
    }
    function entry(...args) {
        return this.fn(...args);
    }
    entry.type = "varargs";
    entry.name = name;
    entry.fn = fn;
    bl().ops.varargs[name] = entry;
}

export function ops() {
    if (bl().ops === undefined) {
        installOps();
    }
    return bl().ops;
}

export function installOps() {
    if (bl().ops !== undefined) {
        console.log("Ops already installed");
        return;
    }
    bl().ops = {
        unary: {},
        named: {},
        varargs: {},
        def: {
            unary,
            named,
            varargs,
        },
    };
}
