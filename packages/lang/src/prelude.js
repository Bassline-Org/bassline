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
    foo: make context!
    in foo [ x: 1 y: 2 ]
    print x
    in foo [ print x print y ]
    print foo
    print self
`;

const parsed = parse(example);
const context = new Context();
installPrelude(context);
evaluate(parsed, context);
