import { normalizeString as normalize } from "../utils.js";

//========================================
// Syntactic Types
//========================================

// Scalar Types
export const VALUE = normalize("value!");
export const NUMBER = normalize("number!");

// Series Types
export const STRING = normalize("string!");
export const BLOCK = normalize("block!");
export const PAREN = normalize("paren!");

export const SERIES = {
    BLOCK,
    PAREN,
    STRING,
};

// Word Types
export const WORD = normalize("word!");
export const GET_WORD = normalize("get-word!");
export const SET_WORD = normalize("set-word!");
export const LIT_WORD = normalize("lit-word!");
//========================================
// Runtime Types
//========================================
export const LOGIC = normalize("logic!");
export const CONTEXT = normalize("context!");
export const NATIVE_FN = normalize("native-fn!");
export const NATIVE_METHOD = normalize("native-method!");
