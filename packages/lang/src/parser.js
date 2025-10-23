import {
    char,
    choice,
    digits,
    endOfInput,
    many,
    recursiveParser,
    regex,
    sequenceOf,
    whitespace,
} from "arcsecond/index.js";
import {
    Block,
    GetWord,
    LitWord,
    Num,
    Paren,
    SetWord,
    Str,
    Word,
} from "./prelude/index.js";
import * as t from "./prelude/datatypes/types.js";

// ===== Comments and Whitespace =====
const comment = sequenceOf([
    char(";"),
    regex(/^[^\n]*/),
]).map(() => null);

const ws = many(
    choice([whitespace.map(() => null), comment]),
).map(() => null);

// ===== Numbers =====
const number = choice([
    digits.map((int) => t.number(Number(int))),
]).errorMap(() => "Expected number");

// ===== Strings =====
const escapeSequence = sequenceOf([char("\\"), regex(/^./)]).map(
    ([_, escaped]) => {
        if (escaped === "n") return "\n";
        if (escaped === "t") return "\t";
        if (escaped === "r") return "\r";
        if (escaped === '"') return '"';
        if (escaped === "\\") return "\\";
        return escaped;
    },
);

const stringChar = choice([
    escapeSequence,
    regex(/^[^"\\]/),
]);

const stringLiteral = sequenceOf([
    char('"'),
    many(stringChar),
    char('"'),
]).map(([_, chars, __]) => t.string(String(chars.join(""))))
    .errorMap(() => "Expected string");

// ===== Words =====
// Word characters (allow everything except whitespace and delimiters)
const wordChars = regex(/^[^ \t\n\r\[\](){}";:']+/);

const getWord = sequenceOf([
    char(":"),
    wordChars,
]).map(([_, spelling]) => t.getWord(spelling))
    .errorMap(() => "Expected get word");

// 'word (literal word)
const litWord = sequenceOf([
    char("'"),
    wordChars,
]).map(([_, spelling]) => t.litWord(spelling))
    .errorMap(() => "Expected literal word");

// word:
const setWord = sequenceOf([
    wordChars,
    char(":"),
]).map(([spelling, _]) => t.setWord(spelling))
    .errorMap(() => "Expected set word");

// word
const normalWord = sequenceOf([
    wordChars,
]).map(([spelling]) => t.word(spelling))
    .errorMap(() => "Expected normal word");

const word = choice([litWord, getWord, setWord, normalWord]);

// Forward declare for recursion
const value = recursiveParser(() => valueParser);

// ===== Blocks =====
const blockParser = sequenceOf([
    char("["),
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    char("]"),
]).map(([_, __, items, ___]) => t.block(items))
    .errorMap(() => "Expected block");

// ===== Parens =====
const parenParser = sequenceOf([
    char("("),
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    char(")"),
]).map(([_, __, items, ___]) => t.paren(items))
    .errorMap(() => "Expected paren");

const valueParser = choice([
    number,
    stringLiteral,
    blockParser,
    parenParser,
    word,
]);

// ===== Program =====
const program = sequenceOf([
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    endOfInput,
]).map(([_, values, __]) => t.block(values)); // Return as block!

export function parse(source) {
    const result = program.run(source);
    if (result.isError) {
        console.error(
            `Parse Error at position ${result.index}: ${result.error}`,
        );
        console.error(
            `Near: "${source.slice(result.index, result.index + 20)}..."`,
        );
        throw result.error;
    }
    return result.result;
}
