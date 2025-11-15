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
  anyCharExcept,
  char,
  choice,
  coroutine,
  digits,
  endOfInput,
  everyCharUntil,
  letter,
  letters,
  lookAhead,
  many,
  many1,
  possibly,
  recursiveParser,
  regex,
  sequenceOf,
  str,
  tapParser,
  whitespace,
} from "arcsecond/index.js";
import { isWildcard, PatternVar, WC, Word, word as w } from "./types.js";
import { matchGraph, pattern, patternQuad as pq } from "./algebra/pattern.js";
import { autoGroup, quad as q } from "./algebra/quad.js";
import * as n from "./nodes.js";
import { Printer, ReplacementVisitor } from "./visitors.js";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert array to PatternQuad
 */
export function toPatternQuad([e, a, v, c]) {
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
  const num = Number((sign ?? "") + whole + (decimal ?? ""));
  return num;
  //return new n.NumberNode(num);
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
]).map(([_, __, chars, ___]) => new n.StringNode(chars.join("")));

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
  char(","),
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
  const p = new PatternVar(chars);
  return new n.VarNode(p);
});

// Wildcard: *
// Returns WC singleton
const wild = sequenceOf([ws, char("*")]).map(([_, __]) => {
  return new n.WildNode();
});

// Word: alice
// Returns new Word("alice")
const word = sequenceOf([
  ws,
  letter.map((c) => c.toUpperCase()),
  wordChars,
]).map(([_, start, chars]) => {
  const wordStr = start + chars;
  const word = new Word(wordStr);
  return new n.WordNode(word);
});

const entityId = choice([wild, patternVar, word]);
const attribute = choice([wild, patternVar, word]);
const value = choice([wild, patternVar, word, number, string]);
const context = choice([wild, patternVar, word]);

const comma = sequenceOf([ws, char(",")]);

// ============================================================================
// Compound values
// ============================================================================

/**
 * A quad is entity, attribute, val, context
 *
 * Context is either WC (wildcard) or a Word
 * We convert WC to null for backward compatibility
 */
const pair = sequenceOf([
  attribute,
  value,
  comma,
]).map(([a, v]) =>
  new n.QuadNode(
    new n.VarNode(new PatternVar("entity")),
    a,
    v,
    new n.VarNode(new PatternVar("context")),
  )
);

const triple = sequenceOf([
  entityId,
  attribute,
  value,
  comma,
]).map(([e, a, v]) =>
  new n.QuadNode(e, a, v, new n.VarNode(new PatternVar("context")))
);

const quad = sequenceOf([
  entityId,
  attribute,
  value,
  context,
  possibly(comma),
]).map(([e, a, v, c]) => new n.QuadNode(e, a, v, c));

const openBracket = sequenceOf([ws, char("{")]);
const closeBracket = sequenceOf([ws, char("}")]);
const openBrace = sequenceOf([ws, char("[")]);
const closeBrace = sequenceOf([ws, char("]")]);
const openParen = sequenceOf([ws, char("(")]);
const closeParen = sequenceOf([ws, char(")")]);
const cmd = (name) => sequenceOf([ws, str(name)]);

// const obj = sequenceOf([
//   entityId,
//   openBracket,
//   many(pair),
//   closeBracket,
// ]).map(([entity, _, entries, __]) => {
//   return entries.map(([attr, value]) => [entity, attr, value, null]);
// });

const quadLike = choice([pair, triple, quad]);
const graph = sequenceOf([
  openBracket,
  many(quadLike),
  closeBracket,
]).map(([_, quads]) => new n.GraphNode(quads));
const obj = graph;

const group = sequenceOf([
  cmd("in"),
  context,
  graph,
]).map(([_, replacement, graph]) => {
  const variable = new PatternVar("context");
  const visitor = new ReplacementVisitor(variable, replacement);
  return visitor.visit(graph);
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
      toAdd.push(q(w("rule"), w("not"), serializePattern(notQuads), name));
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

const operator = (p) => sequenceOf([ws, p]).map(([_, v]) => v);
const numbers = many1(number);
const strings = many1(string);
const listLiteral = recursiveParser(() =>
  sequenceOf([
    ws,
    char("["),
    choice([numbers, strings]),
    ws,
    char("]"),
  ])
).map(([_, __, items]) => items);

const list = choice([listLiteral, numbers, strings]);
// ATOMS: Lists and parenthesized expressions
const atom = recursiveParser(() =>
  choice([
    paren,
    list,
  ])
);

// PREFIX/MONADIC: Applies to atoms
const prefix = recursiveParser(() =>
  choice([
    contextualize, // monadic application
    atom, // or just an atom
  ])
);

const contextualize = sequenceOf([
  letters,
  prefix,
]).map(([word, items]) => {
  return items.map((e) => Array.isArray(e) ? [word, ...e] : [word, e]);
});

const infix = recursiveParser(() =>
  choice([
    union,
    remove,
    prefix,
  ])
);

const binaryExpression = (op) => {
  const opParser = operator(str(op));

  const primaryParser = sequenceOf([
    prefix,
    opParser,
    infix,
  ]).map(([l, _, r]) => [l, r]);

  const lookaheadParser = lookAhead(
    sequenceOf([
      prefix,
      opParser,
    ]),
  );

  return sequenceOf([lookaheadParser, primaryParser]).map(([_, r]) => r);
};

const union = binaryExpression("++").map((
  [left, right],
) => [...left, ...right]);
const remove = binaryExpression("--").map((
  [left, right],
) => {
  return right.filter((e) => !(left.includes(e)));
});

const paren = sequenceOf([
  ws,
  char("("),
  infix, // Parens contain full expressions
  ws,
  char(")"),
]).map(([_, __, val]) => val);

const example = `
  :a :b 4 5 6
  ++
  1 2 3
`;

const parsed = infix.run(example);
console.log(parsed.error);
console.log(parsed.result);
// for (const res of parsed.result[0] ?? []) {
//   res.forEach((v) => {
//     console.log(v);
//     console.log("\n");
//   });
//   console.log("-----\n");
// }
