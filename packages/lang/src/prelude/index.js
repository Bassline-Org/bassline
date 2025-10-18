import types from "./types.js";
import methods from "./actions.js";
import datatypes from "../datatypes/index.js";
import doPrelude from "./do.js";
import print from "./print.js";
import asyncOps from "./async-ops.js";

export default {
    ...datatypes,
    ...types,
    ...methods,
    ...doPrelude,
    ...print,
    ...asyncOps,
};
