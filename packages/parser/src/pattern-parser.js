/**
 * Pattern Parser - Function-Emitting DSL Parser
 *
 * Parses pattern matching DSL and emits executable functions.
 * Each command returns (graph) => { ... } for direct execution.
 *
 * Everything is fundamentally quads: [entity, attribute, value, context]
 *
 * Parser creates typed values:
 * - Words: new Word("alice")
 * - Strings: "hello" (primitive)
 * - Numbers: 42 (primitive)
 * - Pattern variables: new PatternVar("x")
 * - Wildcards: WC (singleton)
 */

import {
  anyChar,
  char,
  choice,
  digits,
  endOfInput,
  everyCharUntil,
  letter,
  many,
  possibly,
  regex,
  sequenceOf,
  str,
  whitespace,
} from "arcsecond/index.js";
import { isWildcard, PatternVar, WC, Word, word as w } from "./types.js";
import { matchGraph, pattern, patternQuad as pq } from "./algebra/pattern.js";
import { quad as q } from "./algebra/quad.js";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert array to PatternQuad
 */
function toPatternQuad([e, a, v, c]) {
  return pq(e, a, v, c ?? WC);
}

/**
 * Build pattern from array of quads
 */
function buildPattern(quads, nacQuads = []) {
  const p = pattern(...quads.map(toPatternQuad));
  if (nacQuads.length > 0) {
    p.setNAC(...nacQuads.map(toPatternQuad));
  }
  return p;
}

/**
 * Serialize pattern quad array to string for reified rules
 */
function serializePattern(quads) {
  return quads.map((parts) => {
    return parts.map((p) => p.toString()).join(" ");
  }).join(" ");
}

/**
 * Substitute variables in production template
 */
export function substitute(val, match) {
  if (val instanceof PatternVar) {
    return match.get(val.name) ?? val;
  }
  if (val === WC) {
    return undefined;
  }
  return val;
}

// ============================================================================
// Basic Tokens
// ============================================================================

const comment = sequenceOf([
  char(";"),
  everyCharUntil(choice([char("\n"), endOfInput])),
  choice([char("\n"), endOfInput]),
]);
const wsOrComment = choice([whitespace, comment]);
const ws = many(wsOrComment);

// ============================================================================
// Value Types (like parser.js)
// ============================================================================

// Number: 42, -3.14
// Returns primitive number
const number = sequenceOf([
  ws,
  possibly(char("-")),
  digits,
  possibly(sequenceOf([char("."), digits]).map(([, decimal]) => decimal)),
]).map(([_, sign, whole, decimal]) => {
  return Number((sign ?? "") + whole + (decimal ?? ""));
});

// String: "hello world" with escape sequences
// Character inside string: either non-special char OR backslash + any char
const stringChar = choice([
  regex(/^[^"\\]/u), // Any char except quote and backslash (Unicode-aware for emojis)
  sequenceOf([char("\\"), anyChar]).map(([slash, c]) => slash + c), // Escape sequence
]);

// String: "hello world" with escape sequences
// Returns primitive string
const string = sequenceOf([
  ws,
  char('"'),
  many(stringChar),
  char('"'),
]).map(([_, __, chars, ___]) => {
  return chars.join("");
});

const delimiter = choice([
  whitespace,
  char("{"),
  char("}"),
  char("["),
  char("]"),
  char('"'),
  char("'"),
  char("<"),
  char(">"),
  endOfInput,
]);

const wordChars = sequenceOf([
  everyCharUntil(delimiter),
]).map(([chars]) => chars.toUpperCase());

// Pattern variable: ?x
// Returns new PatternVar("x")
const patternVar = sequenceOf([
  ws,
  char("?"),
  wordChars,
]).map(([_, __, chars]) => {
  return new PatternVar(chars);
});

// Wildcard: *
// Returns WC singleton
const wild = sequenceOf([ws, char("*")]).map(([_, __]) => {
  return WC;
});

// Word: alice
// Returns new Word("alice")
const word = sequenceOf([
  ws,
  letter.map((c) => c.toUpperCase()),
  wordChars,
]).map(([_, start, chars]) => {
  const wordStr = start + chars;
  return new Word(wordStr);
});

const entityId = choice([number, word]);
const attribute = word;
const value = choice([number, word, string]);
const context = choice([wild, word]);

// ============================================================================
// Compound values
// ============================================================================

/**
 * A quad is entity, attribute, val, context
 * Entity
 * val can be a compound
 *
 * Context is either WC (wildcard) or a Word
 * We convert WC to null for backward compatibility
 */
const quad = sequenceOf([
  entityId,
  attribute,
  value,
  context,
]).map(([e, a, v, c]) => [e, a, v, c instanceof Word ? c : null]);

// Insertions

const objEntry = sequenceOf([
  attribute,
  value,
]);

const openBracket = sequenceOf([ws, char("{")]);
const closeBracket = sequenceOf([ws, char("}")]);
const cmd = (name) => sequenceOf([ws, str(name)]);

const obj = sequenceOf([
  entityId,
  openBracket,
  many(objEntry),
  closeBracket,
]).map(([entity, _, entries, __]) => {
  return entries.map(([attr, value]) => [entity, attr, value, null]);
});
const triple = sequenceOf([
  entityId,
  attribute,
  value,
]).map(([entity, attribute, value]) => [entity, attribute, value, null]);

const group = sequenceOf([
  cmd("in"),
  context,
  openBracket,
  many(choice([triple.map((q) => [q]), obj])),
  closeBracket,
]).map(([_, ctx, __, objs]) => {
  const context = ctx instanceof Word ? ctx : null;
  const quads = objs.flat();
  return quads.map((
    [entity, attribute, value],
  ) => [entity, attribute, value, context]);
});

const insert = sequenceOf([
  cmd("insert"),
  openBracket,
  many(choice([
    group,
    obj,
    quad.map((q) => [q]),
  ])),
  closeBracket,
]).map(([_, __, entries]) => {
  const quads = entries.flat();
  return ({ graph }) => {
    quads.forEach(([e, a, v, c]) => graph.add(q(e, a, v, c)));
  };
});

// Patterns
const patternChoice = (parser) => choice([wild, patternVar, parser]);
const patternQuad = sequenceOf([
  patternChoice(entityId),
  patternChoice(attribute),
  patternChoice(value),
  patternChoice(context),
]);
const patternTriple = sequenceOf([
  patternChoice(entityId),
  patternChoice(attribute),
  patternChoice(value),
]).map(([entity, attribute, value]) => [entity, attribute, value, null]);
const patternObjEntry = sequenceOf([
  patternChoice(attribute),
  patternChoice(value),
]);
const patternObj = sequenceOf([
  patternChoice(entityId),
  openBracket,
  many(patternObjEntry),
  closeBracket,
]).map(([entity, _, entries, __]) =>
  entries.map(([a, v]) => [entity, a, v, null])
);
const patternGroup = sequenceOf([
  cmd("in"),
  patternChoice(context),
  openBracket,
  many(choice([patternTriple.map((q) => [q]), patternObj])),
  closeBracket,
]).map(([_, context, __, objs]) => {
  const quads = objs.flat();
  return quads.map((
    [entity, attribute, value],
  ) => [entity, attribute, value, context]);
});

const patterns = many(choice([
  patternGroup,
  patternObj,
  patternQuad.map((q) => [q]),
])).map((patterns) => patterns.flat());

const where = sequenceOf([
  cmd("where"),
  openBracket,
  patterns,
  closeBracket,
]).map(([_, __, patterns]) => ({ where: patterns }));

const not = sequenceOf([
  cmd("not"),
  openBracket,
  patterns,
  closeBracket,
]).map(([_, __, patterns]) => ({ not: patterns }));

const produce = sequenceOf([
  cmd("produce"),
  openBracket,
  patterns,
  closeBracket,
]).map(([_, __, entries]) => ({
  produce: entries,
}));

const query = sequenceOf([
  cmd("query"),
  where,
  possibly(not),
  possibly(produce),
]).map(([_, { where }, not, produce]) => {
  return (control) => {
    const { graph } = control;
    // Named patterns require resolution
    const whereQuads = where.map((p) =>
      typeof p === "function" ? p(control) : p
    );
    const notQuads = not?.not ?? [];
    const produceQuads = produce?.produce ?? [];

    const p = buildPattern(whereQuads, notQuads);
    const results = matchGraph(graph, p);

    // If there's a produce clause, insert quads for each match
    if (produceQuads.length > 0) {
      results.forEach((match) => {
        produceQuads.forEach(([e, a, v, c]) => {
          graph.add(q(
            substitute(e, match),
            substitute(a, match),
            substitute(v, match),
            substitute(c, match),
          ));
        });
      });
    }

    return results;
  };
});

// Rules
const rule = sequenceOf([
  cmd("rule"),
  word,
  where,
  possibly(not),
  produce,
]).map(([_, name, { where }, not, { produce }]) => {
  const whereQuads = where;
  const notQuads = not?.not ?? [];
  const produceQuads = produce;
  return ({ graph }) => {
    const toAdd = [
      q(w("meta"), w("type"), w("rule!"), name),
      q(w("rule"), w("where"), serializePattern(whereQuads), name),
      q(w("rule"), w("produce"), serializePattern(produceQuads), name),
    ];
    if (notQuads.length > 0) {
      toAdd.push(q(w("rule"), w("nac"), serializePattern(notQuads), name));
      toAdd.push(q(w("meta"), w("nac"), w("true"), name));
    } else {
      toAdd.push(q(w("meta"), w("nac"), w("false"), name));
    }
    toAdd.forEach((quad) => graph.add(quad));
  };
});

const program = many(choice([insert, rule, query]));
export function parseProgram(input) {
  const result = program.run(input);
  if (result.isError) {
    throw new Error(result.message);
  }
  return result.result;
}

/**
 * Parse a single pattern quad string
 * Exported for use in reified rules
 *
 * @param {string} quadStr - Quad string like "?x TYPE PERSON *"
 * @returns {Array} Parsed quad [e, a, v, c]
 */
export function parsePatternQuad(quadStr) {
  const result = patternQuad.run(quadStr);
  if (result.isError) {
    throw new Error(`Failed to parse quad: ${quadStr}\n${result.error}`);
  }
  return result.result;
}

/**
 * Parse patterns
 * Exported for use in React useQuery hook
 *
 * @param {string} input - Patterns like "?x type person" or "group ?x { ?x type person }"
 * @returns {Object} Parsed Patterns
 */
export function parsePatterns(input) {
  const result = patterns.run(input);
  if (result.isError) {
    throw new Error(`Failed to parse patterns: ${result.error}`);
  }
  const parsed = result.result;
  return parsed;
}
