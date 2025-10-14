#!/usr/bin/env node

import { parse } from "../src/parser.js";
import { createPreludeContext, ex } from "../src/prelude.js";

console.log("=== Bassline Functions Demo ===\n");

// Example 1: Simple function
console.log("1. Simple function:");
const code1 = parse(`
    add: func [a b] [+ a b]
    result: add 5 10
    print result
`);
ex(createPreludeContext(), code1);

// Example 2: Nested calls with parens
console.log("\n2. Nested function calls:");
const code2 = parse(`
    add: func [a b] [+ a b]
    mul: func [a b] [* a b]
    result: mul (add 2 3) 4
    print result
`);
ex(createPreludeContext(), code2);

// Example 3: Closures
console.log("\n3. Closures:");
const code3 = parse(`
    make-adder: func [n] [
        func [x] [+ x n]
    ]
    add5: make-adder 5
    add10: make-adder 10
    r1: add5 3
    r2: add10 3
    print r1
    print r2
`);
ex(createPreludeContext(), code3);

// Example 4: Literal arguments
console.log("\n4. Literal arguments (unevaluated):");
const code4 = parse(`
    ; Returns the block it receives without evaluating
    identity: func ['block] [block]

    result: identity [+ 5 10]
    print result
`);
const ctx4 = createPreludeContext();
ex(ctx4, code4);
console.log("  (Block was returned unevaluated)");

// Example 5: Function introspection
console.log("\n5. Function introspection:");
const context5 = createPreludeContext();
const code5 = parse(`
    ; Create a function
    test: func [x] [+ x offset]

    ; Add a field to the function context
    in test [offset: 100]

    ; Now when we call it, it can use offset
    result: test 5
    print result
`);
ex(context5, code5);

// Example 6: Closures capture lexical environment
console.log("\n6. Closures capture lexical environment:");
const context6 = createPreludeContext();
const code6 = parse(`
    make-adder: func [n] [
        func [x] [+ x n]
    ]

    ; Each function closes over its own 'n'
    add5: make-adder 5
    add10: make-adder 10

    r1: add5 3
    r2: add10 7
    print r1   ; Uses n=5 → 8
    print r2   ; Uses n=10 → 17
`);
ex(context6, code6);

console.log("\n=== All Examples Complete ===");
