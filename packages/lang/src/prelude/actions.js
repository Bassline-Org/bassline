import { Method } from "../datatypes/functions.js";

export default {
    // Core arithmetic methods
    "+": Method.binary("add"),
    "-": Method.binary("subtract"),
    "*": Method.binary("multiply"),
    "/": Method.binary("divide"),
    "eq?": Method.binary("equals"),

    // Series methods
    "append": Method.binary("append"),
    "insert": Method.ternary("insert"),
    "pick": Method.binary("pick"),
    "pluck": Method.binary("pluck"),
    "slice": Method.binary("slice"),
    "length": Method.unary("length"),

    // Block methods
    "compose": Method.unary("compose"),
    "reduce": Method.unary("reduce"),
};
