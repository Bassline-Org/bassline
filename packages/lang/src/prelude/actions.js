import { Action } from "../datatypes/functions.js";

export default {
    "+": new Action("add"),
    "-": new Action("subtract"),
    "*": new Action("multiply"),
    "/": new Action("divide"),
    "=": new Action("equals"),

    "append": new Action("append"),
    "insert": new Action("insert"),
    "slice": new Action("slice"),
    "length": new Action("length"),
};
