import { NativeFn, NativeMethod } from "../datatypes/functions.js";

export default {
    // Core arithmetic methods
    "+": NativeMethod.binary("add"),
    "-": NativeMethod.binary("subtract"),
    "*": NativeMethod.binary("multiply"),
    "/": NativeMethod.binary("divide"),
    "eq?": NativeMethod.binary("equals"),

    // Series methods
    "append": NativeMethod.binary("append"),
    "insert": NativeMethod.ternary("insert"),
    "pick": NativeMethod.binary("pick"),
    "pluck": NativeMethod.ternary("pluck"),
    "slice": NativeMethod.ternary("slice"),
    "length": NativeMethod.unary("length"),

    // Block methods
    "compose": NativeMethod.unary("compose"),
    "reduce": NativeMethod.unary("reduce"),

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
