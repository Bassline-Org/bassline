// parser.js
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
} from "arcsecond/index.mjs";
import { make } from "./cells/index.js";

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
            make.num(parseFloat(`${sign}${int}${dot}${dec}`)),
    ),
    // Positive decimal
    sequenceOf([digits, char("."), digits]).map(
        ([int, dot, dec]) => make.num(parseFloat(`${int}${dot}${dec}`)),
    ),
    // Negative integer
    sequenceOf([char("-"), digits]).map(
        ([sign, int]) => make.num(parseFloat(`${sign}${int}`)),
    ),
    // Positive integer
    digits.map((int) => make.num(parseFloat(int))),
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
]).map(([_, chars, __]) => make.string(chars.join("")))
    .errorMap(() => "Expected string");

// ===== Words =====
// Word characters (no slash for path parsing)
const wordCharsNoSlash = regex(/^[^ \t\n\r\[\](){}";/]+/);

// All word types with syntax markers
const word = regex(
    /^[':]?[^ \t\n\r\[\](){}";0-9/][^ \t\n\r\[\](){}";/]*:?|^[+\-*/=<>!?]+:?/,
)
    .map((spelling) => {
        // SET-WORD: ends with : (but doesn't start with :)
        if (spelling.endsWith(":") && !spelling.startsWith(":")) {
            return make.setWord(spelling.slice(0, -1)); // Unbound
        }

        // GET-WORD: starts with :
        if (spelling.startsWith(":")) {
            const name = spelling.slice(1).replace(/:$/, ""); // Remove trailing : if any
            return make.getWord(name); // Unbound
        }

        // LIT-WORD: starts with '
        if (spelling.startsWith("'")) {
            return make.litWord(spelling.slice(1)); // Unbound
        }

        // Regular WORD
        return make.word(spelling); // Unbound
    })
    .errorMap(() => "Expected word");

// REFINEMENT: /word (standalone)
const refinement = sequenceOf([
    char("/"),
    regex(/^[^ \t\n\r\[\](){}";/0-9][^ \t\n\r\[\](){}";/]*/),
]).map(([_, name]) => make.refinement(name))
    .errorMap(() => "Expected refinement");

// Forward declare for recursion
const value = recursiveParser(() => valueParser);

// ===== Blocks =====
const blockParser = sequenceOf([
    char("["),
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    char("]"),
]).map(([_, __, items, ___]) => make.block(items))
    .errorMap(() => "Expected block");

// ===== Parens =====
const parenParser = sequenceOf([
    char("("),
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    char(")"),
]).map(([_, __, items, ___]) => make.paren(items))
    .errorMap(() => "Expected paren");

// ===== Paths =====
// Paths are word/word/word or word/number/word, etc.
// Each segment becomes an element in the path series
const pathParser = sequenceOf([
    wordCharsNoSlash,
    many1(sequenceOf([char("/"), wordCharsNoSlash])),
]).map(([first, segments]) => {
    const parts = [make.word(first)]; // First element (unbound word)

    segments.forEach(([_, segment]) => {
        // Check if segment is a number
        if (/^-?\d+(\.\d+)?$/.test(segment)) {
            parts.push(make.num(parseFloat(segment)));
        } else {
            // It's a word (could be refinement-style but in path context)
            parts.push(make.word(segment)); // Unbound
        }
    });

    return make.path(parts);
}).errorMap(() => "Expected path");

// ===== Value Parser (Main) =====
const valueParser = choice([
    pathParser, // Must come before word (contains /)
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
]).map(([_, values, __]) => make.block(values)); // Return as block!

// ===== Export =====
export function parse(source) {
    const result = program.run(source);

    if (result.isError) {
        throw new Error(
            `Parse error at position ${result.index}: ${result.error}`,
        );
    }

    return result.result; // Returns a BlockCell
}
