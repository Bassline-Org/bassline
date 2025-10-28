/**
 * Bassline core data types
 *
 * These are the atomic data types that makeup the bassline language
 */

export const TYPES = {
    number: "NUMBER!",
    string: "STRING!",
    word: "WORD!",
    getWord: "GET-WORD!",
    setWord: "SET-WORD!",
    litWord: "LIT-WORD!",
    block: "BLOCK!",
    paren: "PAREN!",
    uri: "URI!",
};

const normalize = (name) => name.toUpperCase();

/**
 * Create a number cell
 * @param {Number} value
 * @returns
 */
const number = (value) => ({
    type: TYPES.number,
    value: Number(value),
});
const string = (value) => ({
    type: TYPES.string,
    value: String(value),
});
const word = (value) => ({
    type: TYPES.word,
    value: normalize(value),
});
const getWord = (value) => ({
    type: TYPES.getWord,
    value: normalize(value),
});
const setWord = (value) => ({
    type: TYPES.setWord,
    value: normalize(value),
});
const litWord = (value) => ({
    type: TYPES.litWord,
    value: normalize(value),
});
const block = (value) => ({
    type: TYPES.block,
    value: Array.from(value),
});
const paren = (value) => ({
    type: TYPES.paren,
    value: Array.from(value),
});
const uri = (value) => ({
    type: TYPES.uri,
    value,
});

export const CELLS = {
    number,
    string,
    word,
    getWord,
    setWord,
    litWord,
    block,
    paren,
    uri,
};
