import {
    char,
    choice,
    digit,
    digits,
    endOfInput,
    everyCharUntil,
    letter,
    many,
    many1,
    recursiveParser,
    regex,
    sequenceOf,
    str,
    whitespace,
} from "arcsecond/index.mjs";
import {
    Block,
    File,
    Num,
    Paren,
    Path,
    Str,
    Tuple,
    Url,
    Word,
} from "./nodes.js";

// ===== Helper Parsers =====

// Comments start with ; and go to end of line
const comment = sequenceOf([
    char(";"),
    regex(/^[^\n]*/),
]).map(() => null);

// Whitespace and comments (optional)
const ws = many(
    choice([
        whitespace.map(() => null),
        comment,
    ]),
).map(() => null);

// Word delimiters
const isDelimiter = (c) => /[ \t\n\r\[\](){}";]/.test(c) || c === undefined;

// ===== Number Parser =====
const number = choice([
    // Negative decimal: -123.45
    sequenceOf([char("-"), digits, char("."), digits]).map(
        ([sign, int, dot, dec]) =>
            new Num(parseFloat(`${sign}${int}${dot}${dec}`)),
    ),
    // Positive decimal: 123.45
    sequenceOf([digits, char("."), digits]).map(
        ([int, dot, dec]) => new Num(parseFloat(`${int}${dot}${dec}`)),
    ),
    // Negative integer: -123
    sequenceOf([char("-"), digits]).map(
        ([sign, int]) => new Num(parseFloat(`${sign}${int}`)),
    ),
    // Positive integer: 123
    digits.map((int) => new Num(parseFloat(int))),
]).errorMap(() => "Expected number");

// ===== String Parser =====
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
    regex(/^[^"\\]/), // any char except " and \
]);

const stringLiteral = sequenceOf([
    char('"'),
    many(stringChar),
    char('"'),
])
    .map(([_, chars, __]) => new Str(chars.join("")))
    .errorMap(() => "Expected string");

// ===== Word Parser =====
// Words are greedy - they consume until they hit a delimiter
// For paths, we need wordChars to NOT include /
const wordCharsNoSlash = regex(/^[^ \t\n\r\[\](){}";/]+/);

// But must NOT start with a digit (that would be a number/tuple/path)
const word = regex(
    /^[^ \t\n\r\[\](){}";0-9/][^ \t\n\r\[\](){}";/]*|^[+\-*/=<>!?]+/,
)
    .map((chars) => new Word(chars))
    .errorMap(() => "Expected word");

// ===== File Parser =====
// Files start with % followed by path (unquoted or quoted)
const unquotedFilePath = regex(/^[^ \t\n\r\[\](){}";]+/);

const quotedFilePath = sequenceOf([
    char('"'),
    many(stringChar),
    char('"'),
]).map(([_, chars, __]) => chars.join(""));

const file = sequenceOf([
    char("%"),
    choice([quotedFilePath, unquotedFilePath]),
])
    .map(([_, path]) => new File(path))
    .errorMap(() => "Expected file path");

// ===== Forward declarations for recursive parsers =====
// Create recursive parser for values
const value = recursiveParser(() => valueParser);

// ===== Block Parser =====
const blockParser = sequenceOf([
    char("["),
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    char("]"),
])
    .map(([_, __, items, ___]) => new Block(items))
    .errorMap(() => "Expected block");

// ===== Paren Parser =====
const parenParser = sequenceOf([
    char("("),
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    char(")"),
])
    .map(([_, __, items, ___]) => new Paren(items))
    .errorMap(() => "Expected paren");

// ===== Path Parser =====
// Paths are parsed as: word/word/word or word/123
const pathParser = sequenceOf([
    wordCharsNoSlash,
    many1(sequenceOf([char("/"), wordCharsNoSlash])),
])
    .map(([first, segments]) => {
        const parts = [new Word(first)];
        segments.forEach(([_, segment]) => {
            // Check if segment is a number
            if (/^-?\d+(\.\d+)?$/.test(segment)) {
                parts.push(new Num(parseFloat(segment)));
            } else {
                parts.push(new Word(segment));
            }
        });
        return new Path(parts);
    })
    .errorMap(() => "Expected path");

// ===== Tuple Parser =====
// Tuples are numbers separated by dots: 1.2.3.4 (at least 3 segments)
const tupleParser = sequenceOf([
    digits,
    char("."),
    digits,
    many1(sequenceOf([char("."), digits])),
])
    .map(([first, _, second, segments]) => {
        const numbers = [parseInt(first, 10), parseInt(second, 10)];
        segments.forEach(([_, num]) => {
            numbers.push(parseInt(num, 10));
        });
        return new Tuple(numbers);
    })
    .errorMap(() => "Expected tuple");

// ===== URL Parser =====
// URLs start with http:// or https://
const urlParser = sequenceOf([
    choice([str("https://"), str("http://")]),
    regex(/^[^ \t\n\r\[\](){}";]+/),
])
    .map(([protocol, rest]) => new Url(protocol + rest))
    .errorMap(() => "Expected URL");

// ===== Value Parser (Main Entry Point) =====
const valueParser = choice([
    urlParser, // Must come before path (http:// vs word/word)
    tupleParser, // Must come before number (1.2.3 vs 1.2)
    file, // Must come before word (% prefix)
    pathParser, // Must come before word (contains /)
    number,
    stringLiteral,
    blockParser,
    parenParser,
    word,
]);

// ===== Top-level Parser =====
const program = sequenceOf([
    ws,
    many(
        sequenceOf([value, ws]).map(([v, _]) => v),
    ),
    endOfInput,
]).map(([_, values, __]) => values);

// ===== Export =====
export function parse(source) {
    const result = program.run(source);

    if (result.isError) {
        throw new Error(
            `Parse error at position ${result.index}: ${result.error}`,
        );
    }

    return result.result;
}
