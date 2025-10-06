/// Defines operations for the system
/// We use these instead of passing explicit functions when building function gadgets
/// They are categorized into 3 types:
/// 1. ops.unary - a function that takes a single argument, and immediately returns the result
/// 2. ops.named - a function that takes argument and knows what keys it requires to compute the result. IE fixed named arguments
/// 3. ops.varargs - a function that takes an arbitrary map of arguments, and computes the result incrementally IE things like sum, average etc

import { bl } from "../index.js";
bl();
import { Partial, Transform } from "../patterns/functions/index.js";

function unary({ name, fn, override = false }) {
    if (bl().ops.unary[name] !== undefined && !override) {
        console.log(`Op ${name} already defined`);
        console.log("Use override = true to overwrite this entry!");
        return;
    }
    bl().ops.unary[name] = {
        type: "unary",
        name,
        fn,
        call(...args) {
            return fn(...args);
        },
    };
}

function named({ name, fn, requiredKeys, override = false }) {
    if (bl().ops.named[name] !== undefined && !override) {
        console.log(`Op ${name} already defined`);
        console.log("Use override = true to overwrite this entry!");
        return;
    }
    bl().ops.named[name] = {
        type: "named",
        name,
        fn,
        requiredKeys,
        call(...args) {
            return fn(...args);
        },
    };
}

function varargs({ name, fn, override = false }) {
    if (bl().ops.varargs[name] !== undefined && !override) {
        console.log(`Op ${name} already defined`);
        console.log("Use override = true to overwrite this entry!");
        return;
    }
    bl().ops.varargs[name] = {
        type: "varargs",
        name,
        fn,
        call(...args) {
            return fn(...args);
        },
    };
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
