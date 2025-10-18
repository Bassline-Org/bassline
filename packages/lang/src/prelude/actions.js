import { Block, Num } from "../datatypes/core.js";
import { NativeFn, NativeMethod } from "../datatypes/functions.js";

export default {
    // Core arithmetic methods
    "+": NativeMethod.binary("add"),
    "-": NativeMethod.binary("subtract"),
    "*": NativeMethod.binary("multiply"),
    "/": NativeMethod.binary("divide"),
    "eq?": NativeMethod.binary("equals"),

    // Series methods
    "update": NativeMethod.ternary("update"),
    "append": NativeMethod.binary("append"),
    "insert": NativeMethod.ternary("insert"),
    "pick": NativeMethod.binary("pick"),
    "pluck": NativeMethod.ternary("pluck"),
    "slice": NativeMethod.ternary("slice"),
    "length": NativeMethod.unary("length"),
    "iota": new NativeFn(["n"], ([n], stream, context) => {
        const arr = Array.from({ length: n.value }, (_, i) => new Num(i));
        return new Block(arr);
    }),

    // Block methods
    "compose": NativeMethod.unary("compose"),
    "reduce": NativeMethod.unary("reduce"),
    "fold": NativeMethod.ternary("fold"),
    "map": NativeMethod.binary("map"),

    // Control flow
    "if": new NativeFn(
        ["condition", "true-body", "false-body"],
        ([condition, ifTrue, ifFalse], stream, context) => {
            if (condition.evaluate(stream, context)) {
                return ifTrue.evaluate(stream, context);
            } else {
                return ifFalse.evaluate(stream, context);
            }
        },
    ),

    // Documentation
    "doc": NativeMethod.binary("doc"),
    "describe": NativeMethod.unary("describe"),
};
