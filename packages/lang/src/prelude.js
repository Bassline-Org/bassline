import types from "./prelude/types.js";
import methods from "./prelude/actions.js";
import datatypes, { Context } from "./datatypes/index.js";
import { evaluate } from "./evaluator.js";
import { parse } from "./parser.js";
import doPrelude from "./prelude/do.js";
import print from "./prelude/print.js";

export function installPrelude(context) {
    context.setMany({
        ...datatypes,
        ...types,
        ...methods,
        ...doPrelude,
        ...print,
    });
}

const example = `
    a: 10
    b: 20
    added: + a b
    c: 30
    print eq? added c

    foo: [a b c]
    bar: [a b c]
    print eq? foo bar
    baz: append foo 'd
    print eq? baz bar
`;

const parsed = parse(example);
const context = new Context();
installPrelude(context);
evaluate(parsed, context);
