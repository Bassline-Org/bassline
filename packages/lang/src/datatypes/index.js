export * from "./core.js";
export * from "./functions.js";
export * from "./context.js";
import core from "./core.js";
import functions from "./functions.js";
import context from "./context.js";
//export * from "./events.js";

export default {
    ...core,
    ...functions,
    ...context,
};
