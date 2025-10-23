import { normalize } from "../../utils.js";

const cell = (type) => (value) => ({
    type,
    value,
});

export const TYPES = {
    // Literal data types
    number: normalize("number!"),
    string: normalize("string!"),
    block: normalize("block!"),
    paren: normalize("paren!"),

    // Word Types
    word: normalize("word!"),
    getWord: normalize("get-word!"),
    setWord: normalize("set-word!"),
    litWord: normalize("lit-word!"),

    // Function Types
    nativeFn: normalize("native-fn!"),
    nativeMethod: normalize("native-method!"),
    fn: normalize("fn!"),

    // Context Types
    context: normalize("context!"),
    contextChain: normalize("context-chain!"),

    // Datatype type
    datatype: normalize("datatype!"),

    // Condition type
    condition: normalize("condition!"),
};

export const number = cell(TYPES.number);
export const string = cell(TYPES.string);
export const block = cell(TYPES.block);
export const paren = cell(TYPES.paren);

export const word = (spelling) => cell(TYPES.word)(normalize(spelling));
export const getWord = (spelling) => cell(TYPES.getWord)(normalize(spelling));
export const setWord = (spelling) => cell(TYPES.setWord)(normalize(spelling));
export const litWord = (spelling) => cell(TYPES.litWord)(normalize(spelling));

export const nativeFn = cell(TYPES.nativeFn);
export const nativeMethod = cell(TYPES.nativeMethod);
export const fn = cell(TYPES.fn);

export const context = cell(TYPES.context);
export const contextChain = cell(TYPES.contextChain);

export const datatype = cell(TYPES.datatype);
export const condition = cell(TYPES.condition);

export const DIRECT_TYPES = new Set([
    TYPES.number,
    TYPES.string,
    TYPES.block,
]);
export const SERIES_TYPES = new Set([
    TYPES.block,
    TYPES.paren,
    TYPES.string,
]);
export const WORD_TYPES = new Set([
    TYPES.word,
    TYPES.getWord,
    TYPES.setWord,
    TYPES.litWord,
]);
export const FUNCTION_TYPES = new Set([
    TYPES.nativeFn,
    TYPES.nativeMethod,
    TYPES.fn,
]);
export const CONTEXT_TYPES = new Set([
    TYPES.context,
    TYPES.contextChain,
]);

// Type predicates
export const isDirect = ({ type }) => DIRECT_TYPES.has(type);
export const isSeries = ({ type }) => SERIES_TYPES.has(type);
export const isAnyWord = ({ type }) => WORD_TYPES.has(type);
export const isContext = ({ type }) => CONTEXT_TYPES.has(type);
export const isFunction = ({ type }) => FUNCTION_TYPES.has(type);

// Helpers
export const iter = (cell) => {
    if (isSeries(cell)) {
        return cell.value.values();
    }
    throw new Error(`Cannot iterate over type: ${cell.type}`);
};

export const lookup = (context, word) => {
    if (isContext(context) && isAnyWord(word)) {
        const bound = context.value.get(word.value);
        if (!bound) {
            throw new Error(
                `Word ${word.value.toString()} not found in context`,
            );
        }
        console.log("bound: ", bound);
        return bound;
    }
    throw new Error(`Cannot lookup word: ${word} in context: ${context.type}`);
};

export const bind = (context, key, value) => {
    if (isContext(context) && isAnyWord(key)) {
        context.value.set(key.value, value);
        return value;
    }
    throw new Error(
        `Cannot bind word: ${key} to value: ${value} in context: ${context.type}`,
    );
};
