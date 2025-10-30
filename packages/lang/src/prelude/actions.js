import { Block, nativeFn, Num, Str, TYPES } from "./datatypes/index.js";
import { parse } from "../parser.js";
import { Value } from "./index.js";

export default {
    // Basic introspection
    "print": nativeFn("value", (value) => {
        const formed = value?.form?.()?.value;
        if (Array.isArray(formed)) {
            console.log(
                formed.map((each) =>
                    each instanceof Value ? each.form().value : each
                ).join(""),
            );
        } else {
            console.log(formed);
        }
        return value;
    }),
    "form": nativeFn("value", (value) => value.form()),
    "mold": nativeFn("value", (value) => new Str(value.mold())),
    "type?": nativeFn("value", (value) => value.getType()),

    // Basic evaluation

    // Core arithmetic methods
    "+": nativeFn("a b", (a, b) => a.add(b)),
    "-": nativeFn("a b", (a, b) => a.subtract(b)),
    "*": nativeFn("a b", (a, b) => a.multiply(b)),
    "/": nativeFn("a b", (a, b) => a.divide(b)),
    "//": nativeFn("a b", (a, b) => a.modulo(b)),
    ">": nativeFn("a b", (a, b) => a.gt(b)),
    "<": nativeFn("a b", (a, b) => a.lt(b)),
    ">=": nativeFn("a b", (a, b) => a.gte(b)),
    "<=": nativeFn("a b", (a, b) => a.lte(b)),
    "eq?": nativeFn("a b", (a, b) => a.equals(b)),
    "cast": nativeFn("value type", (a, b) => a.cast(b)),

    // Series methods
    "append": nativeFn("list value", (list, value) => list.append(value)),
    "insert": nativeFn(
        "list index value",
        (list, index, value) => list.insert(index, value),
    ),
    "unique": nativeFn("list", (list) => list.unique()),
    "pick": nativeFn("list index", (list, index) => list.pick(index)),
    "pluck": nativeFn("list index", (list, index) => list.pluck(index)),
    "slice": nativeFn(
        "list start end",
        (list, start, end) => list.slice(start, end),
    ),
    "length": nativeFn("list", (list) => list.length()),
    "iota": nativeFn(
        "n",
        (n) => new Block(Array.from({ length: n.value }, (_, i) => new Num(i))),
    ),
    "shape": nativeFn(
        "fill dims",
        (fill, dims) => makeShape(fill, dims.to(TYPES.block).items),
    ),
    "concat": nativeFn("list1 list2", (list1, list2) => list1.concat(list2)),

    // Block methods
    "compose": nativeFn("block", (block, context) => block.compose(context)),
    "reduce": nativeFn(
        "block",
        (block, context) => block.reduce(context),
    ),
    "do": nativeFn("block", (block, context) => block.doBlock(context)),
    "in": nativeFn("context block", (context, block) => context.doBlock(block)),
    "load": nativeFn("string", (string) => parse(string.value)),
    "fold": nativeFn(
        "series fn initial",
        (series, fn, initial, context) => series.fold(fn, initial, context),
    ),

    // Control flow
    "if": nativeFn(
        "condition ifTrue ifFalse",
        (condition, ifTrue, ifFalse, context, iter) => {
            const result = condition.evaluate(context, iter);
            if (result.to(TYPES.bool)?.value) {
                return ifTrue.doBlock(context);
            } else {
                return ifFalse.doBlock(context);
            }
        },
    ),

    // Context methods
    "get": nativeFn("context word", (context, word) => context.get(word)),
    "set": nativeFn(
        "context word value",
        (context, word, value) => context.set(word, value),
    ),
    "delete": nativeFn("context word", (context, word) => context.delete(word)),
    "clone": nativeFn("context", (context) => context.clone()),
    "copy": nativeFn(
        "context targetContext",
        (context, targetContext) => context.copy(targetContext),
    ),
    "merge": nativeFn(
        "context contexts",
        (context, contexts) => context.merge(contexts),
    ),
    "project": nativeFn(
        "context words",
        (context, words) => context.project(words),
    ),
    "has": nativeFn("context word", (context, word) => context.has(word)),
    "delete": nativeFn("context word", (context, word) => context.delete(word)),
    "rename": nativeFn(
        "context oldWords newWords",
        (context, oldWords, newWords) => context.rename(oldWords, newWords),
    ),
    "fresh": nativeFn("context", (context) => context.fresh()),
    "values": nativeFn("context", (context) => context.values()),
    "keys": nativeFn("context", (context) => context.keys()),
    "doc": nativeFn("value doc", (value, doc) => value.doc(doc)),
    "describe": nativeFn("value", (value) => value.describe()),

    "pause": nativeFn("", (context, iter) => {
        return new Block(iter.toArray());
    }),
};

function makeShape(fill, dims) {
    const [dim, ...rest] = dims;
    if (rest.length === 0) {
        return new Block(
            Array.from({ length: dim.value }, (_, i) => fill),
        );
    }
    return new Block(
        Array.from({ length: dim.value }, (_, i) => makeShape(fill, rest)),
    );
}
