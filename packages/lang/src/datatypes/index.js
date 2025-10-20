import core from "./core.js";
import functions from "./functions.js";
import context from "./context.js";
import async from "./async.js";

export {
    Block,
    Datatype,
    GetWord,
    LitWord,
    nil,
    Num,
    Paren,
    SetWord,
    Str,
    Word,
} from "./core.js";
export { NativeFn, NativeMethod, PureFn } from "./functions.js";
export { ContextBase, ContextChain } from "./context.js";
export { Task } from "./async.js";

export default {
    ...core,
    ...functions,
    ...context,
    ...async,
};
