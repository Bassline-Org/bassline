import { Block, Bool, Num } from "./datatypes/core.js";
import { NativeFn, NativeMethod } from "./datatypes/functions.js";
import { evaluate } from "../evaluator.js";

export default {
    // Core arithmetic methods
    "+": NativeMethod.binary("add"),
    "-": NativeMethod.binary("subtract"),
    "*": NativeMethod.binary("multiply"),
    "/": NativeMethod.binary("divide"),
    "//": NativeMethod.binary("modulo"),
    "eq?": NativeMethod.binary("equals"),
    "cast": NativeMethod.binary("cast"),

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
    "concat": NativeMethod.binary("concat"),

    // Block methods
    "compose": NativeMethod.unary("compose"),
    "reduce": NativeMethod.unary("reduce"),
    "fold": NativeMethod.ternary("fold"),

    // Control flow
    "if": new NativeFn(
        ["condition", "true-body", "false-body"],
        ([condition, ifTrue, ifFalse], stream, context) => {
            if (condition.evaluate(stream, context).to("bool!")?.value) {
                return evaluate(ifTrue, context);
            } else {
                return evaluate(ifFalse, context);
            }
        },
    ),

    // Context methods
    "get": NativeMethod.binary("get"),
    "set": NativeMethod.ternary("set"),
    "delete": NativeMethod.binary("delete"),
    "clone": NativeMethod.unary("clone"),
    "copy": NativeMethod.binary("copy"),
    "merge": NativeMethod.binary("merge"),
    "project": NativeMethod.binary("project"),
    "has": NativeMethod.binary("has"),
    "words": NativeMethod.unary("words"),
    "rename": NativeMethod.ternary("rename"),
    "fresh": NativeMethod.unary("fresh"),

    // Documentation
    "doc": NativeMethod.binary("doc"),
    "describe": NativeMethod.unary("describe"),
};
