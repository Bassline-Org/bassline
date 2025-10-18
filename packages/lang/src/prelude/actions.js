import { Action } from "../datatypes/functions.js";

export default {
    "+": Action.binary("add"),
    "-": Action.binary("subtract"),
    "*": Action.binary("multiply"),
    "/": Action.binary("divide"),
    "=": Action.binary("equals"),

    "append": Action.binary("append"),
    "insert": Action.ternary("insert"),
    "pick": Action.binary("pick"),
    "slice": Action.binary("slice"),
    "length": Action.unary("length"),
};
