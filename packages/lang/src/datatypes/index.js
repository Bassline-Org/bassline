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
export { Fn, NativeFn, NativeMethod } from "./functions.js";
export { Context } from "./context.js";
export { Task } from "./async.js";

export default {
    ...core,
    ...functions,
    ...context,
    ...async,
};
