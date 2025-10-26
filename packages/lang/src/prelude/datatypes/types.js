import { normalize } from "../../utils.js";

export const TYPES = {
    // Literal data types
    number: normalize("number!"),
    string: normalize("string!"),
    block: normalize("block!"),
    paren: normalize("paren!"),
    bool: normalize("bool!"),
    char: normalize("char!"),
    restart: normalize("restart!"),

    // Word Types
    word: normalize("word!"),
    getWord: normalize("get-word!"),
    setWord: normalize("set-word!"),
    litWord: normalize("lit-word!"),

    // Function Types
    nativeFn: normalize("native-fn!"),
    fn: normalize("fn!"),

    // Context Types
    context: normalize("context!"),
    contextChain: normalize("context-chain!"),

    // Datatype type
    datatype: normalize("datatype!"),

    // Condition type
    condition: normalize("condition!"),
    restart: normalize("restart!"),

    // URL type
    url: normalize("url!"),
};

// Type Sets
// Direct Types are types that evaluate to themselves
export const DIRECT_TYPES = new Set([
    TYPES.number,
    TYPES.string,
    TYPES.block,
    TYPES.datatype,
    TYPES.context,
    TYPES.contextChain,
    TYPES.char,
]);

// Series Types also evaluate to themselves, but are collections of other values
export const SERIES_TYPES = new Set([
    TYPES.block,
    TYPES.paren,
    TYPES.string,
    TYPES.url,
]);

// Word Types are types that have a spelling, and require a context to be evaluated
export const WORD_TYPES = new Set([
    TYPES.word,
    TYPES.getWord,
    TYPES.setWord,
    TYPES.litWord,
]);

// Function types
export const FUNCTION_TYPES = new Set([
    TYPES.nativeFn,
    TYPES.fn,
]);

// Context types
// Context types are types that can store and retrive values by a normalized spelling
export const CONTEXT_TYPES = new Set([
    TYPES.context,
    TYPES.contextChain,
    // Functions are also context types, since they hold their arguments and body internally
    TYPES.fn,
]);

// Type predicates
export const isDirect = (cell) => DIRECT_TYPES.has(cell.type);
export const isSeries = (cell) => SERIES_TYPES.has(cell.type);
export const isAnyWord = (cell) => WORD_TYPES.has(cell.type);
export const isContext = (cell) => CONTEXT_TYPES.has(cell.type);
export const isFunction = (cell) => FUNCTION_TYPES.has(cell.type);
