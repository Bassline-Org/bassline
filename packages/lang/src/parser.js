import {
    char,
    choice,
    digits,
    endOfInput,
    many,
    many1,
    recursiveParser,
    regex,
    sequenceOf,
    whitespace,
} from "arcsecond/index.js";
import {
    BlockCell,
    GetWordCell,
    LitWordCell,
    NumberCell,
    ParenCell,
    PathCell,
    RefinementCell,
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
]).map(([_, spelling]) => new SetWordCell(spelling))
    .errorMap(() => "Expected set word");

// word
const normalWord = sequenceOf([
    wordChars,
]).map(([spelling]) => new WordCell(spelling))
    .errorMap(() => "Expected normal word");

const word = choice([normalWord, setWord, litWord, getWord]);

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

// :word/word/word
const getPath = sequenceOf([
    char(":"),
    word,
    many1(sequenceOf([char("/"), word]).map(([v, _]) => v)),
]).map(([_, word, segments]) => new GetPathCell([word, ...segments]));

// word/word/word:
const setPath = sequenceOf([
    word,
    many1(sequenceOf([char("/"), word]).map(([v, _]) => v)),
    word,
    char(":"),
]).map(([word, segments, word2]) =>
    new SetPathCell([word, ...segments, word2])
);

// 'word/word/word
const litPath = sequenceOf([
    char("'"),
    word,
    many1(sequenceOf([char("/"), word]).map(([v, _]) => v)),
]).map(([_, word, segments]) => new LitPathCell([word, ...segments]));

// word/word/word
const normalPath = sequenceOf([
    word,
    many1(sequenceOf([char("/"), word]).map(([v, _]) => v)),
]).map(([word, segments]) => new PathCell([word, ...segments]));

const path = choice([setPath, getPath, litPath, normalPath]);

const valueParser = choice([
    path, // Must come before word (contains /)
    refinement, // Must come before word (starts with /)
    number, // Must come before word (starts with digits)
    stringLiteral,
    blockParser,
    parenParser,
    word, // Last - catches everything else
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
        throw new Error(
            `Parse Error! ${result.error} at position ${result.index} near "${
                source.slice(result.index, result.index + 10)
            }"`,
        );
    }
    return result.result;
}
