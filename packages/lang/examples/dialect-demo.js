#!/usr/bin/env node

import { parse } from "../src/parser.js";
import { createPreludeContext, ex } from "../src/prelude.js";

// Example: Using the gadget dialect to define and use gadgets
const code = parse(`
    ; Define a counter gadget
    counter: gadget [
        pkg: "@demo/gadgets"
        name: "counter"
        state: 0
    ]

    ; Define a display gadget
    display: gadget [
        pkg: "@demo/gadgets"
        name: "display"
        state: ""
    ]

    ; Spawn instances
    c1: spawn counter
    c2: spawn counter 10
    d: spawn display

    ; Send values to gadgets
    send c1 5
    send c2 25

    ; Get current state
    result1: current c1
    result2: current c2

    ; Print results
    print result1
    print result2
`);

console.log("=== Bassline Dialect Demo ===\n");
console.log("Running code:");
console.log(code.items.map(i => i.toJSON ? i.toJSON() : i).join(' '));
console.log("\n--- Output ---");

const context = createPreludeContext();
ex(context, code);

console.log("\n--- Context ---");
console.log("Gadget prototypes defined:");
const counterProto = context.get(Symbol.for("COUNTER"));
console.log(`  counter: ${counterProto.pkg}/${counterProto.name}`);

const displayProto = context.get(Symbol.for("DISPLAY"));
console.log(`  display: ${displayProto.pkg}/${displayProto.name}`);

console.log("\nGadget instances:");
const c1 = context.get(Symbol.for("C1"));
const c2 = context.get(Symbol.for("C2"));
console.log(`  c1 state: ${c1.current()}`);
console.log(`  c2 state: ${c2.current()}`);

console.log("\n=== Link Dialect Demo ===\n");

// Example: Using the link dialect (without real tap support yet)
const linkCode = parse(`
    a: spawn counter
    b: spawn counter
    c: spawn counter

    link [
        a -> b
        b => [c]
    ]
`);

console.log("Creating wired gadgets...");
ex(context, linkCode);
console.log("Link dialect executed successfully!");
console.log("(Full wiring will work when integrated with @bassline/core)");
