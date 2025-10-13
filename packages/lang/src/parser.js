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
    RefinementCell,
    SeriesBuffer,
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
const wordCharsNoSlash = regex(/^[^ \t\n\r\[\](){}";:\/]+/);

// All word types with syntax markers
const word = sequenceOf([
    regex(/^[:']?/),
    wordCharsNoSlash,
    regex(/^:?/),
])
    .map(([get, spelling, set]) => {
        if (get === ":") {
            return new GetWordCell(spelling);
        }
        if (get === "'") {
            return new LitWordCell(spelling);
        }
        if (set) {
            return new SetWordCell(spelling);
        }
        return new WordCell(spelling);
    })
    .errorMap(() => "Expected word");

// REFINEMENT: /word (standalone)
const refinement = sequenceOf([
    char("/"),
    wordCharsNoSlash,
]).map(([_, name]) => new RefinementCell(name))
    .errorMap(() => "Expected refinement");

// Forward declare for recursion
const value = recursiveParser(() => valueParser);

// ===== Blocks =====
const blockParser = sequenceOf([
    char("["),
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    char("]"),
]).map(([_, __, items, ___]) => new BlockCell(new SeriesBuffer(items)))
    .errorMap(() => "Expected block");

// ===== Parens =====
const parenParser = sequenceOf([
    char("("),
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    char(")"),
]).map(([_, __, items, ___]) => new ParenCell(new SeriesBuffer(items)))
    .errorMap(() => "Expected paren");

// ===== Paths =====
// Paths are word/word/word or word/number/word, etc.
// Each segment becomes an element in the path series
const pathParser = sequenceOf([
    wordCharsNoSlash,
    many1(sequenceOf([char("/"), wordCharsNoSlash])),
]).map(([first, segments]) => {
    const parts = [new WordCell(first)]; // First element (unbound word)

    segments.forEach(([_, segment]) => {
        // Check if segment is a number
        if (/^-?\d+(\.\d+)?$/.test(segment)) {
            parts.push(new NumberCell(parseFloat(segment)));
        } else {
            // It's a word (could be refinement-style but in path context)
            parts.push(new WordCell(segment)); // Unbound
        }
    });

    return new PathCell(new SeriesBuffer(parts));
}).errorMap(() => "Expected path");

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
