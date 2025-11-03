/**
 * LEGACY PARSER - Replaced by pattern-parser.js
 *
 * This file contains the original parser implementation.
 * Kept for backward compatibility but should not be used for new code.
 * Use pattern-parser.js instead.
 */

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
import { CELLS as c } from "./data.js";

// ===== Comments and Whitespace =====
export const comment = sequenceOf([
    char(";"),
    regex(/^[^\n]*/),
]).map(() => null);

export const ws = many(
    choice([whitespace.map(() => null), comment]),
).map(() => null);

// ===== Numbers =====
export const number = choice([
    digits.map((int) => c.number(Number(int))),
]).errorMap(() => "Expected number");

// ===== Strings =====
export const escapeSequence = sequenceOf([char("\\"), regex(/^./)]).map(
    ([_, escaped]) => {
        if (escaped === "n") return "\n";
        if (escaped === "t") return "\t";
        if (escaped === "r") return "\r";
        if (escaped === '"') return '"';
        if (escaped === "\\") return "\\";
        return escaped;
    },
);

export const stringChar = choice([
    escapeSequence,
    regex(/^[^"\\]/),
]);

export const stringLiteral = sequenceOf([
    char('"'),
    many(stringChar),
    char('"'),
]).map(([_, chars, __]) => c.string(String(chars.join(""))))
    .errorMap(() => "Expected string");

// ===== Words =====
// Word characters (allow everything except whitespace and delimiters)
export const wordChars = regex(/^[^ \t\n\r\[\](){}";:']+/);

export const getWord = sequenceOf([
    char(":"),
    wordChars,
]).map(([_, spelling]) => c.getWord(spelling))
    .errorMap(() => "Expected get word");

// 'word (literal word)
export const litWord = sequenceOf([
    char("'"),
    wordChars,
]).map(([_, spelling]) => c.litWord(spelling))
    .errorMap(() => "Expected literal word");

// word:
export const setWord = sequenceOf([
    wordChars,
    char(":"),
]).map(([spelling, _]) => c.setWord(spelling))
    .errorMap(() => "Expected set word");

// word
export const normalWord = sequenceOf([
    wordChars,
]).map(([spelling]) => c.word(spelling))
    .errorMap(() => "Expected normal word");

export const word = choice([litWord, getWord, setWord, normalWord]);

// ===== URI Parsing (RFC 3986 compliant) =====
// URI structure: scheme://[userinfo@]host[:port][/path][?query][#fragment]

// Scheme: must start with letter, followed by letters, digits, +, -, or .
export const uriScheme = regex(/^[a-zA-Z][a-zA-Z0-9+.-]*/);

// Userinfo: optional username[:password] before @ (we'll capture everything before @)
export const uriUserinfo = regex(/^[^@\/\s]+/);

// Host: domain name or IP address
// Domain: alphanumeric and hyphens, dots for subdomains
// IPv4: four groups of 1-3 digits
// IPv6: enclosed in square brackets (simplified pattern)
export const uriHost = choice([
    // IPv6 in brackets
    sequenceOf([
        char("["),
        regex(/^[0-9a-fA-F:]+/),
        char("]"),
    ]).map(([_, ipv6, __]) => ipv6),
    // Domain name or IPv4
    regex(
        /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*/,
    ),
]);

// Port: optional colon followed by digits
export const uriPort = sequenceOf([
    char(":"),
    digits,
]).map(([_, port]) => port);

// Path: everything until ? or # or delimiter
// Exclude whitespace and our language delimiters: [ ] ( ) { } " ;
export const uriPath = regex(/^[^?#\s\[\](){}";]*/);

// Query: everything after ? until # or delimiter
export const uriQuery = sequenceOf([
    char("?"),
    regex(/^[^#\s\[\](){}";]*/),
]).map(([_, query]) => query);

// Fragment: everything after # until delimiter
export const uriFragment = sequenceOf([
    char("#"),
    regex(/^[^\s\[\](){}";]*/),
]).map(([_, fragment]) => fragment);

// Authority: [userinfo@]host[:port]
export const uriAuthority = sequenceOf([
    // Optional userinfo@
    choice([
        sequenceOf([
            uriUserinfo,
            char("@"),
        ]).map(([userinfo, _]) => userinfo),
        // No userinfo
        sequenceOf([]).map(() => null),
    ]),
    // Required host
    uriHost,
    // Optional port
    choice([
        uriPort,
        sequenceOf([]).map(() => null),
    ]),
]).map(([userinfo, host, port]) => ({ userinfo, host, port }));

// Full URL parser
export const uriParser = sequenceOf([
    // Scheme is required
    sequenceOf([uriScheme, char(":")]).map(([scheme, _]) => scheme),
    // Authority with // prefix (optional for some schemes like mailto:)
    choice([
        sequenceOf([
            char("/"),
            char("/"),
            uriAuthority,
            // Path after authority (can be empty)
            uriPath,
        ]).map(([_, __, auth, path]) => ({
            hasAuthority: true,
            ...auth,
            path: path || null,
        })),
        // No authority, just path (for schemes like mailto:, file:, etc.)
        // But we need a non-empty path to distinguish from set-words
        // Also exclude our language delimiters
        regex(/^[^?#\s\[\](){}";]+/).map((path) => ({
            hasAuthority: false,
            userinfo: null,
            host: null,
            port: null,
            path: path,
        })),
    ]),
    // Optional query
    choice([
        uriQuery,
        sequenceOf([]).map(() => null),
    ]),
    // Optional fragment
    choice([
        uriFragment,
        sequenceOf([]).map(() => null),
    ]),
]).map(([scheme, authorityAndPath, query, fragment]) => {
    // Create a context-based URL with components
    // Scheme and host are case-insensitive (stored as words)
    // Path, query, fragment, userinfo are case-sensitive (stored as strings)
    // Port is stored as a number
    const uriContext = c.uri({
        scheme: c.word(scheme.toLowerCase()), // Normalize scheme to lowercase
        userinfo: authorityAndPath.userinfo
            ? c.string(authorityAndPath.userinfo)
            : null,
        host: authorityAndPath.host
            ? c.word(authorityAndPath.host.toLowerCase())
            : null, // Normalize host to lowercase
        port: authorityAndPath.port
            ? c.number(Number(authorityAndPath.port))
            : null,
        path: authorityAndPath.path ? c.string(authorityAndPath.path) : null,
        query: query ? c.string(query) : null,
        fragment: fragment ? c.string(fragment) : null,
    });

    return uriContext;
})
    .errorMap(() => "Expected URI");

// Forward declare for recursion
export const value = recursiveParser(() => valueParser);

// ===== Blocks =====
export const blockParser = sequenceOf([
    char("["),
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    char("]"),
]).map(([_, __, items, ___]) => c.block(items))
    .errorMap(() => "Expected block");

// ===== Parens =====
export const parenParser = sequenceOf([
    char("("),
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    char(")"),
]).map(([_, __, items, ___]) => c.paren(items))
    .errorMap(() => "Expected paren");

export const valueParser = choice([
    number,
    stringLiteral,
    blockParser,
    parenParser,
    uriParser,
    word,
]);

// ===== Program =====
export const program = sequenceOf([
    ws,
    many(sequenceOf([value, ws]).map(([v, _]) => v)),
    endOfInput,
]).map(([_, values, __]) => c.block(values)); // Return as block!

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
