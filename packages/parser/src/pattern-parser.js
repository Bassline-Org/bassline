/**
 * Pattern Parser - Simple tokenizer for pattern matching DSL
 *
 * Like parser.js, this is primarily a tokenizer that identifies structures.
 * Semantics are handled by the runtime (pattern-words.js).
 *
 * Everything is fundamentally quads: [entity, attribute, value, context]
 */

import {
  anyChar,
  between,
  char,
  choice,
  digits,
  endOfInput,
  everyCharUntil,
  everythingUntil,
  letter,
  letters,
  many,
  many1,
  possibly,
  recursiveParser,
  regex,
  sequenceOf,
  startOfInput,
  str,
  whitespace,
} from "arcsecond/index.js";

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
const number = sequenceOf([
  ws,
  possibly(char("-")),
  digits,
  possibly(sequenceOf([char("."), digits]).map(([, decimal]) => decimal)),
]).map(([_, sign, whole, decimal]) => {
  const number = Number((sign ?? "") + whole + (decimal ?? ""));
  return { number };
});

// String: "hello world" with escape sequences
// Character inside string: either non-special char OR backslash + any char
const stringChar = choice([
  regex(/^[^"\\]/u), // Any char except quote and backslash (Unicode-aware for emojis)
  sequenceOf([char("\\"), anyChar]).map(([slash, c]) => slash + c), // Escape sequence
]);

const string = sequenceOf([
  ws,
  char('"'),
  many(stringChar),
  char('"'),
]).map(([_, __, chars, ___]) => {
  const str = chars.join("");
  return { string: str };
});

const delimiter = choice([
  whitespace,
  char("{"),
  char("}"),
  char("["),
  char("]"),
  char('"'),
  char("'"),
  endOfInput,
]);

const wordChars = sequenceOf([
  everyCharUntil(delimiter),
]).map(([chars]) => chars.toUpperCase());

const patternVar = sequenceOf([
  ws,
  char("?"),
  wordChars,
]).map(([_, __, chars]) => {
  return { patternVar: chars };
});

const wild = sequenceOf([ws, char("*")]).map(([_, __]) => {
  return { wildcard: "*" };
});

const word = sequenceOf([
  ws,
  letter.map((c) => c.toUpperCase()),
  wordChars,
]).map(([_, start, chars]) => {
  const word = start + chars;
  return { word };
});

const scalar = choice([number, string, wild, patternVar, word]);

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
 */
const quad = sequenceOf([
  entityId,
  attribute,
  value,
  context,
]).map(([e, a, v, c]) => [e, a, v, c.wildcard ? null : c.word]);

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

const group = sequenceOf([
  cmd("group"),
  context,
  openBracket,
  many(obj),
  closeBracket,
]).map(([_, context, __, objs]) => {
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
]).map(([_, __, entries]) => ({
  insert: entries.flat(),
}));

// Patterns
const patternChoice = (parser) => choice([wild, patternVar, parser]);
const patternQuad = sequenceOf([
  patternChoice(entityId),
  patternChoice(attribute),
  patternChoice(value),
  patternChoice(context),
]);
const patternObjEntry = sequenceOf([
  patternChoice(attribute),
  patternChoice(value),
]);
const patternObj = sequenceOf([
  patternChoice(entityId),
  openBracket,
  many(patternObjEntry),
  closeBracket,
]).map(([entity, _, entries, __]) => entries.map(([a, v]) => [entity, a, v, null]));

const patternGroup = sequenceOf([
  cmd("group"),
  patternChoice(context),
  openBracket,
  many(patternObj),
  closeBracket,
]).map(([_, context, __, objs]) => {
  const quads = objs.flat();
  return quads.map((
    [entity, attribute, value],
  ) => [entity, attribute, value, context]);
});

const where = sequenceOf([
  cmd("where"),
  openBracket,
  many(choice([
    patternGroup,
    patternObj,
    patternQuad.map((q) => [q]),
  ])),
  closeBracket,
]).map(([_, __, patterns]) => ({ where: patterns.flat() }));

const not = sequenceOf([
  cmd("not"),
  openBracket,
  many(choice([
    patternGroup,
    patternObj,
    patternQuad.map((q) => [q]),
  ])),
  closeBracket,
]).map(([_, __, patterns]) => ({ not: patterns.flat() }));

const query = sequenceOf([
  cmd("query"),
  where,
  possibly(not),
]).map(([_, { where }, not]) => ({
  query: {
    where,
    not: not?.not ?? [],
  },
}));

const produce = sequenceOf([
  cmd("produce"),
  openBracket,
  many(choice([
    patternGroup,
    patternObj,
    patternQuad.map((q) => [q]),
  ])),
  closeBracket,
]).map(([_, __, entries]) => ({
  produce: entries.flat(),
}));

// Rules
const rule = sequenceOf([
  cmd("rule"),
  word,
  where,
  possibly(not),
  produce,
]).map(([_, name, { where }, not, { produce }]) => ({
  rule: {
    name,
    where,
    not: not?.not ?? [],
    produce,
  },
}));

const test = `
  produce {
    foo loves bar system
    group some-context {
      alice {
        likes bob
      }
    }
    some-context {
      source goose
    }
  }
`;

const res = produce.run(test);
console.log("Parse result:", JSON.stringify(res, null, 2));
