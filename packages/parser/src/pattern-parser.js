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
]).map(([_, sign, whole, decimal]) =>
  Number((sign ?? "") + whole + (decimal ?? ""))
);

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
  return {
    pattern: chars,
  };
});

const wild = sequenceOf([ws, char("_")]).map(([_, __]) => {
  return {
    wild: true,
  };
});

const word = sequenceOf([
  ws,
  letter.map((c) => c.toUpperCase()),
  wordChars,
]).map(([_, start, chars]) => {
  return {
    word: start + chars,
  };
});

const litWord = sequenceOf([
  ws,
  char("'"),
  choice([patternVar, wild, word]),
]).map(([_, __, word]) => ({
  literal: true,
  ...word,
}));

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
    return [...value.triples, [entity, attribute, value.id]];
  } else {
    return [[entity, attribute, value]];
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
  const id = { word: `obj-${crypto.randomUUID()}` };
  const triples = entries.reduce((acc, [attr, val]) => {
    if (val.triples) {
      return [
        ...acc,
        ...val.triples,
        [id, attr, val.id],
      ];
    }
    return [...acc, [id, attr, val]];
  }, [[id, { word: "TYPE?" }, { word: "OBJECT!" }]]);

  return {
    type: "object",
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
  const id = { word: `list-${crypto.randomUUID()}` };
  const triples = values.reduce((acc, val, index) => {
    if (val.triples) {
      return [...acc, ...val.triples, [id, index, val.id]];
    }
    return [...acc, [id, index, val]];
  }, [[id, { word: "TYPE?" }, { word: "LIST!" }]]);
  return {
    type: "list",
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
]).map(([_, __, { word }]) => ({ name: word }));

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
  const result = program.run(input);

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
}
