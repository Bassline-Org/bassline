/**
 * Bassline core data types
 *
 * These are the atomic data types that makeup the bassline language
 */
import { createHash, randomUUID } from "crypto";

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

export const normalize = (name) => name.trim().toUpperCase();
export const hash = (value) =>
    `0x${createHash("sha256").update(value).digest("hex")}`;

/**
 * Create a number cell
 * @param {Number} value
 * @returns
 */
const number = (value) => ({
    type: TYPES.number,
    value: Number(value),
    id: value,
});

const string = (value) => ({
    type: TYPES.string,
    value: String(value),
    id: hash(value),
});

const word = (value) => ({
    type: TYPES.word,
    value: normalize(value),
    id: normalize(value),
});
const getWord = (value) => ({
    type: TYPES.getWord,
    value: normalize(value),
    id: normalize(`:${value}`),
});
const setWord = (value) => ({
    type: TYPES.setWord,
    value: normalize(value),
    id: normalize(`${value}:`),
});
const litWord = (value) => ({
    type: TYPES.litWord,
    value: normalize(value),
    id: normalize(`'${value}`),
});
const block = (value) => ({
    type: TYPES.block,
    value: Array.from(value),
    id: randomUUID(),
});
const paren = (value) => ({
    type: TYPES.paren,
    value: Array.from(value),
    id: randomUUID(),
});
const uri = (value) => ({
    type: TYPES.uri,
    value,
    id: randomUUID(),
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
