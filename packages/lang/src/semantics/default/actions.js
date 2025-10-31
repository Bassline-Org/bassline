// No parser imports - parsing happens in dialect/semantics layer
import { composeBlock, evaluateBlock, reduceBlock } from "./evaluate.js";
import { makeState, runUntilDone } from "./state.js";
import { doSemantics } from "./dialect.js";
// Import directly from individual files to avoid circular dependency
import { Block, Num, Str, Value, Word } from "./datatypes/core.js";
import { Datatype } from "./datatypes/core.js";
import { nativeFn } from "./datatypes/functions.js";
import { TYPES } from "./datatypes/types.js";
import { dispatchPolymorphic } from "./polymorphic.js";

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
    "type?": nativeFn("value", (value) => new Datatype(value.constructor)),

    // Basic evaluation

    // Core arithmetic methods - use polymorphic dispatch
    "+": nativeFn("a b", (a, b) => dispatchPolymorphic("+", a, b)),
    "-": nativeFn("a b", (a, b) => dispatchPolymorphic("-", a, b)),
    "*": nativeFn("a b", (a, b) => dispatchPolymorphic("*", a, b)),
    "/": nativeFn("a b", (a, b) => dispatchPolymorphic("/", a, b)),
    "//": nativeFn("a b", (a, b) => dispatchPolymorphic("//", a, b)),
    ">": nativeFn("a b", (a, b) => dispatchPolymorphic(">", a, b)),
    "<": nativeFn("a b", (a, b) => dispatchPolymorphic("<", a, b)),
    ">=": nativeFn("a b", (a, b) => dispatchPolymorphic(">=", a, b)),
    "<=": nativeFn("a b", (a, b) => dispatchPolymorphic("<=", a, b)),
    "eq?": nativeFn("a b", (a, b) => dispatchPolymorphic("eq?", a, b)),
    "cast": nativeFn("value type", (a, b) => a.cast(b)),

    // Series methods
    "chunk": nativeFn(
        "list chunkSize",
        (list, chunkSize) => list.chunk(chunkSize.to(TYPES.number)),
    ),
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
    "compose": nativeFn(
        "block",
        (block, context) => composeBlock(block, context),
    ),
    "reduce": nativeFn(
        "block",
        (block, context) => reduceBlock(block, context),
    ),
    "do": nativeFn("block", (block, context) => {
        return evaluateBlock(block, context);
    }),
    "in": nativeFn("context block", (context, block) => {
        return evaluateBlock(block, context);
    }),
    // load removed - parsing should happen in dialect/semantics layer, not in value definitions
    "on": nativeFn("target kind fn", (target, kind, fn, context) => {
        const kindStr = kind.to(TYPES.string).value;
        const handler = (event) => {
            evaluateBlock(new Block([fn, event.detail]), context);
        };
        target.emitter.addEventListener(
            kindStr,
            handler,
        );
        return nativeFn("", () => {
            target.emitter.removeEventListener(
                kindStr,
                handler,
            );
            return new Word("true");
        });
    }),
    "fold": nativeFn(
        "series fn initial",
        (series, fn, initial, context) => {
            let acc = initial;
            for (const item of series.items) {
                evaluateBlock(new Block([fn, acc, item]), context, (result) => {
                    acc = result;
                });
            }
            return acc;
        },
    ),

    // Control flow
    "if": nativeFn(
        "condition ifTrue ifFalse",
        (condition, ifTrue, ifFalse, context) => {
            // TODO: Fix condition evaluation - need to use evaluator
            // For now, assume condition is already evaluated
            if (condition.to(TYPES.bool)?.value) {
                return evaluateBlock(ifTrue, context);
            } else {
                return evaluateBlock(ifFalse, context);
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
