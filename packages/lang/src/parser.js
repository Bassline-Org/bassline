import {
    anythingExcept,
    char,
    choice,
    digits,
    endOfInput,
    lookAhead,
    many,
    many1,
    possibly,
    recursiveParser,
    regex,
    sequenceOf,
    whitespace,
} from "arcsecond/index.js";

import {
    BlockCell,
    GetPathCell,
    GetWordCell,
    LitPathCell,
    LitWordCell,
    NumberCell,
    ParenCell,
    PathCell,
    RefinementCell,
    SetPathCell,
    SetWordCell,
    StringCell,
    WordCell,
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
    // Negative decimal
    sequenceOf([char("-"), digits, char("."), digits]).map(
        ([sign, int, dot, dec]) =>
            new NumberCell(parseFloat(`${sign}${int}${dot}${dec}`)),
    ),
    // Positive decimal
    sequenceOf([digits, char("."), digits]).map(
        ([int, dot, dec]) => new NumberCell(parseFloat(`${int}${dot}${dec}`)),
    ),
    // Negative integer
    sequenceOf([char("-"), digits]).map(
        ([sign, int]) => new NumberCell(parseFloat(`${sign}${int}`)),
    ),
    // Positive integer
    digits.map((int) => new NumberCell(parseFloat(int))),
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
]).map(([_, chars, __]) => new StringCell(chars.join("")))
    .errorMap(() => "Expected string");

// ===== Words =====
// Word characters (no slash for path parsing)
const wordChars = regex(/^[^ \t\n\r\[\](){}";:\/]+/);

// 'word
const litWord = sequenceOf([
    char("'"),
    wordChars,
]).map(([_, spelling]) => new LitWordCell(spelling))
    .errorMap(() => "Expected lit word");

// :word
const getWord = sequenceOf([
    char(":"),
    wordChars,
]).map(([_, spelling]) => new GetWordCell(spelling))
    .errorMap(() => "Expected get word");

// word:
const setWord = sequenceOf([
    wordChars,
    char(":"),
]).map(([spelling, _]) => new SetWordCell(spelling))
    .errorMap(() => "Expected set word");

// word
const normalWord = sequenceOf([
    wordChars,
]).map(([spelling]) => new WordCell(spelling))
    .errorMap(() => "Expected normal word");

const word = choice([setWord, litWord, getWord, normalWord]);

const refinement = sequenceOf([
    char("/"),
    wordChars,
]).map(([_, spelling]) => new RefinementCell(spelling))
    .errorMap(() => "Expected refinement");

// Forward declare for recursion
const value = recursiveParser(() => valueParser);

// ===== Blocks =====
const blockParser = sequenceOf([
    char("["),
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    char("]"),
]).map(([_, __, items, ___]) => new BlockCell(items))
    .errorMap(() => "Expected block");

// ===== Parens =====
const parenParser = sequenceOf([
    char("("),
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    char(")"),
]).map(([_, __, items, ___]) => new ParenCell(items))
    .errorMap(() => "Expected paren");

const pathSegment = choice([
    number,
    wordChars.map((segment) => new LitWordCell(segment)),
]);

// :word/word/word
const getPath = sequenceOf([
    char(":"),
    wordChars,
    lookAhead(char("/")),
    many1(sequenceOf([char("/"), pathSegment]).map(([_, segment]) => segment)),
]).map(([_, word, __, segments]) =>
    new GetPathCell([new GetWordCell(word), ...segments])
);

// word/word/word:
const setPath = sequenceOf([
    wordChars,
    lookAhead(char("/")),
    many1(sequenceOf([char("/"), pathSegment]).map(([_, segment]) => segment)),
    char(":"),
]).map(([word, _, segments, __]) =>
    new SetPathCell([new WordCell(word), ...segments])
);

// 'word/word/word
const litPath = sequenceOf([
    char("'"),
    wordChars,
    lookAhead(char("/")),
    many1(sequenceOf([char("/"), pathSegment]).map(([_, segment]) => segment)),
]).map(([_, word, __, segments]) =>
    new LitPathCell([new LitWordCell(word), ...segments])
);

// word/word/word
const normalPath = sequenceOf([
    wordChars,
    lookAhead(char("/")),
    many1(sequenceOf([char("/"), pathSegment]).map(([_, segment]) => segment)),
]).map(([word, _, segments]) =>
    new PathCell([new WordCell(word), ...segments])
);

const path = choice([getPath, litPath, setPath, normalPath]);

const valueParser = choice([
    number,
    stringLiteral,
    blockParser,
    parenParser,
    path,
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
