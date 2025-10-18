import * as core from "./core.js";
import * as functions from "./functions.js";
import * as context from "./context.js";

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
export { Fn, Method, NativeFn } from "./functions.js";
export { Context } from "./context.js";

export default {
    ...core,
    ...functions,
    ...context,
};
