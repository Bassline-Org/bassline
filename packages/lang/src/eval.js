import { Context } from "./datatypes/context.js";
import { NativeFn } from "./datatypes/functions.js";
import { parse } from "./parser.js";
import { Stream } from "./stream.js";

const example = `
  a: 123
  b: 456
  c: + a b
  print c
  d: - c 10
  print d
`;

function evaluate(code, context) {
    const stream = new Stream(code.items);
    let result = null;
    while (!stream.isAtEnd()) {
        result = stream.next().evaluate(stream, context);
    }
    return result;
}

const parsed = parse(example);
const context = new Context();
context.set("+", new NativeFn(["a", "b"], ([a, b], context) => a.add(b)));
context.set(
    "-",
    new NativeFn(["a", "b"], ([a, b], context) => a.subtract(b)),
);
context.set(
    "*",
    new NativeFn(["a", "b"], ([a, b], context) => a.multiply(b)),
);
context.set(
    "/",
    new NativeFn(["a", "b"], ([a, b], context) => a.divide(b)),
);
context.set(
    "print",
    new NativeFn(["a"], ([a], context) => {
        console.log(a);
        return a;
    }),
);
const result = evaluate(parsed, context);

console.log("result: ", result);
