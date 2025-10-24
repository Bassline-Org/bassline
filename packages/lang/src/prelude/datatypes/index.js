import core from "./core.js";
import functions from "./functions.js";
import context from "./context.js";
import async from "./async.js";

export {
    Block,
    Bool,
    Datatype,
    GetWord,
    LitWord,
    Num,
    Paren,
    SetWord,
    Str,
    //    Unset,
    //    unset,
    Value,
    Word,
    WordLike,
} from "./core.js";
export { NativeFn, NativeMethod, PureFn } from "./functions.js";
export { ContextBase, ContextChain, setMany } from "./context.js";
export { Task } from "./async.js";

export default {
    ...core,
    ...functions,
    ...context,
    ...async,
};
