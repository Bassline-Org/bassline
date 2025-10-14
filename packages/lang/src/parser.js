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
} from "./cells/index.js";

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
    digits.map((int) => new Num({ value: Number(int) })),
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
]).map(([_, chars, __]) => new Str({ value: chars.join("") }))
    .errorMap(() => "Expected string");

// ===== Words =====
// Word characters (no slash for path parsing)
const wordChars = regex(/^[^ \t\n\r\[\](){}";:\/]+/);

// 'word
const litWord = sequenceOf([
    char("'"),
    wordChars,
]).map(([_, spelling]) => new LitWord({ spelling }))
    .errorMap(() => "Expected lit word");

// :word
const getWord = sequenceOf([
    char(":"),
    wordChars,
]).map(([_, spelling]) => new GetWord({ spelling }))
    .errorMap(() => "Expected get word");

// word:
const setWord = sequenceOf([
    wordChars,
    char(":"),
]).map(([spelling, _]) => new SetWord({ spelling }))
    .errorMap(() => "Expected set word");

// word
const normalWord = sequenceOf([
    wordChars,
]).map(([spelling]) => new Word({ spelling }))
    .errorMap(() => "Expected normal word");

const word = choice([setWord, litWord, getWord, normalWord]);

// Forward declare for recursion
const value = recursiveParser(() => valueParser);

// ===== Blocks =====
const blockParser = sequenceOf([
    char("["),
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    char("]"),
]).map(([_, __, items, ___]) => new Block({ value: items }))
    .errorMap(() => "Expected block");

// ===== Parens =====
const parenParser = sequenceOf([
    char("("),
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    char(")"),
]).map(([_, __, items, ___]) => new Paren({ value: items }))
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
]).map(([_, values, __]) => values); // Return as block!

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
