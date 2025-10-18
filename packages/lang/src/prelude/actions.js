import { Method } from "../datatypes/functions.js";

export default {
    "+": Method.binary("add"),
    "-": Method.binary("subtract"),
    "*": Method.binary("multiply"),
    "/": Method.binary("divide"),
    "=": Method.binary("equals"),

    "append": Method.binary("append"),
    "insert": Method.ternary("insert"),
    "pick": Method.binary("pick"),
    "pluck": Method.binary("pluck"),
    "slice": Method.binary("slice"),
    "length": Method.unary("length"),
};
