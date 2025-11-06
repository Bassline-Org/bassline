/**
 * Pattern Parser - Simple tokenizer for pattern matching DSL
 *
 * Like parser.js, this is primarily a tokenizer that identifies structures.
 * Semantics are handled by the runtime (pattern-words.js).
 *
 * Everything is fundamentally triples: [source, attr, target]
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
  lookAhead,
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

let store = null;

// ============================================================================
// Simple portable hash function for strings (FNV-1a)
// ============================================================================
function hashString(value) {
  const str = String(value);
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash *= 16777619; // FNV prime
    hash = hash >>> 0;
  }
  return String(hash);
}

const wordId = (word) => `w:${word.toUpperCase()}`;
const numberId = (num) => `n:${num}`;

const idParser = sequenceOf([
  letters,
  char(":"),
  letters,
]).map(([prefix, _, suffix]) => [prefix, suffix]);
export const parseId = (id) => idParser.run(id).result;

// ============================================================================
// Basic Tokens
// ============================================================================

// Comments: ; to end of line
const comment = sequenceOf([
  char(";"),
  everyCharUntil(choice([char("\n"), endOfInput])),
  choice([char("\n"), endOfInput]),
]);

// Whitespace and comments
const wsOrComment = choice([whitespace, comment]);
const ws = many(wsOrComment);
const ws1 = many1(whitespace);

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
  const id = `n:${number.toString()}`;
  store.set(id, number);
  return { id };
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
  const hash = `s:${hashString(str)}`;
  store.set(hash, str);
  return { id: hash };
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
  const id = `v:${chars}`;
  store.set(id, chars);
  return { id };
});

const wild = sequenceOf([ws, char("_")]).map(([_, __]) => {
  const id = "w:_";
  store.set(id, true);
  return { id };
});

const word = sequenceOf([
  ws,
  letter.map((c) => c.toUpperCase()),
  wordChars,
]).map(([_, start, chars]) => {
  const word = start + chars;
  const id = wordId(word);
  store.set(id, word);
  return { id };
});

const litWord = sequenceOf([
  ws,
  char("'"),
  choice([patternVar, wild, word]),
]).map(([_, __, word]) => {
  const [type, wordId] = parseId(word);
  const id = `lw:${wordId}`;
  store.set(id, word);
  return { id };
});

const scalar = choice([number, string, wild, litWord, patternVar, word]);

// ============================================================================
// Compound values
// ============================================================================

const compound = recursiveParser(() =>
  sequenceOf([
    ws,
    choice([
      obj,
      list,
    ]),
  ]).map(([_, value]) => value)
);

const value = recursiveParser(() => {
  return choice([
    compound,
    scalar,
  ]);
});

/**
 * A triple is entity, attribute, val
 * Entity, attribute, are scalar
 * val can be a compound
 */
const triple = sequenceOf([
  scalar,
  scalar,
  value,
]).map((
  [entity, attribute, value],
) => {
  if (value.triples) {
    return [...value.triples, [entity.id, attribute.id, value.id]];
  } else {
    return [[entity.id, attribute.id, value.id]];
  }
});

const objEntry = sequenceOf([
  scalar,
  value,
]);

const obj = sequenceOf([
  ws,
  char("{"),
  many(
    objEntry,
  ),
  ws,
  char("}"),
]).map(([_, __, entries]) => {
  const sortedEntries = entries.slice().sort((a, b) => a[0].id - b[0].id);
  const id = `o:${
    hashString(
      sortedEntries.map(([attr, val]) => attr.id + val.id).join(""),
    )
  }`;
  let triples = [];
  const values = new Map();
  for (const [attr, val] of sortedEntries) {
    if (val.triples) {
      triples = [...triples, ...val.triples];
    }
    values.set(attr, val.id);

    triples.push([id, attr.id, val.id]);
    triples.push([val.id, wordId("MEMBER"), id]);
  }
  triples.push([id, wordId("TYPE"), wordId("OBJECT!")]);
  store.set(id, values);
  return {
    id,
    triples,
  };
});

const list = sequenceOf([
  ws,
  char("["),
  many(value),
  ws,
  char("]"),
]).map(([_, __, values]) => {
  const id = `l:${hashString(values.map((val) => val.id).join(""))}`;
  let triples = [];
  const valueMap = new Map();
  for (let index = 0; index < values.length; index++) {
    const val = values[index];
    const indexId = numberId(index);
    if (val.triples) {
      triples = [...triples, ...val.triples];
    }
    valueMap.set(indexId, val.id);
    triples.push([id, indexId, val.id]);
    triples.push([val.id, wordId("MEMBER"), id]);
  }
  triples.push([id, wordId("TYPE"), wordId("LIST!")]);
  store.set(id, valueMap);
  return {
    id,
    triples,
  };
});

const triples = many(
  choice([
    obj.map((obj) => obj.triples),
    list.map((list) => list.triples),
    triple,
  ]),
).map((triples) => triples.reduce((acc, triple) => [...acc, ...triple], []));

const cmd = (name) => sequenceOf([ws, str(name)]).map(([_, name]) => name);
const body = (parser) =>
  sequenceOf([
    sequenceOf([ws, char("{")]),
    parser,
    sequenceOf([ws, char("}")]),
  ]).map(([_, body]) => body);

const insert = sequenceOf([
  cmd("insert"),
  body(triples),
]).map(([_, trips]) => {
  return { insert: trips };
});

const where = sequenceOf([
  cmd("where"),
  body(triples),
]).map(([_, trips]) => {
  return { where: trips };
});

const not = sequenceOf([
  cmd("not"),
  body(triples),
]).map(([_, trips]) => {
  return { not: trips };
});

const select = sequenceOf([
  cmd("select"),
  where,
  possibly(not),
]).map(([_, { where }, { not }]) => {
  return {
    select: {
      where,
      not: not ?? [],
    },
  };
});

const ruleHead = sequenceOf([
  cmd("rule"),
  ws,
  word,
]).map(([_, __, name]) => ({ name: name.id }));

const rule = sequenceOf([
  ruleHead,
  where,
  possibly(not),
  insert,
]).map(([{ name }, { where }, not, { insert }]) => {
  return {
    rule: {
      name,
      where,
      not: not?.not ?? [],
      insert,
    },
  };
});

const program = many(choice([rule, select, insert]));

function parseProgram(input) {
  store = new Map();
  const result = program.run(input);
  if (result.isError) {
    throw new Error(`Parse error at position ${result.index}: ${result.error}`);
  }
  return {
    result,
    store,
  };
}

const input = `
  insert {
    root foo 123
    root bar [1 2 3]
  }

  select
    where {
      ?x type type!
    }
    not {
      ?x name foo
    }

  rule foo
    where {
      ?x type type!
    }
    not {
      ?x name foo
    }
    insert {
      ?x name foo
    }
`;

{
  const { result, store } = parseProgram(input);

  console.log("Remaining input: ", input.substring(result.index, input.length));
  if (result.isError) {
    console.error(`Parse error at position ${result.index}: ${result.error}`);
    console.log("error: ", result.error);
    console.log("remaining: ", input.substring(result.index, input.length));
    console.log("remaining length: ", input.length - result.index);
  } else {
    for (const { insert, select, rule } of result.result) {
      if (insert) {
        console.log("insert: ", insert);
      }
      if (select) {
        const { where, not } = select;
        console.log("Select:");
        console.log(" where: ", where);
        console.log(" not: ", not);
      }
      if (rule) {
        const { name, where, not, insert } = rule;
        console.log("Rule: ", name);
        console.log(" Where: ", where);
        console.log(" Not: ", not);
        console.log(" Insert: ", insert);
      }
    }
  }

  console.log(store);
}
