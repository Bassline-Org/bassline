/// Gadget Dialect
/// Used for describing gadget behavior

import { parse } from "../parser.js";
import { Block } from "../values.js";

function gadget(context, spec) {
}

const example = `
counter: gadget [
    validate: [input] [
        if [number? input] [
            return input
        ]
    ]
]

`;

const parsed = parse(example);

const obj = parsed.toJSON();
console.log(JSON.stringify(obj, null, 2));
