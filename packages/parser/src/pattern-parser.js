/**
 * Pattern Parser - Simple tokenizer for pattern matching DSL
 *
 * Like parser.js, this is primarily a tokenizer that identifies structures.
 * Semantics are handled by the runtime (pattern-words.js).
 *
 * Everything is fundamentally triples: [source, attr, target]
 */

import {
  char,
  choice,
  digits,
  endOfInput,
  many,
  many1,
  possibly,
  regex,
  sequenceOf,
  str,
  whitespace,
} from "arcsecond/index.js";

// ============================================================================
// Basic Tokens
// ============================================================================

// Comments: ; to end of line
const comment = sequenceOf([
  char(";"),
  regex(/^[^\n]*/),
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
  regex(/^-?/),
  digits,
  possibly(regex(/^\.\d+/)),
]).map(([sign, whole, decimal]) => Number(sign + whole + (decimal || "")));

// String: "hello world"
const string = sequenceOf([
  char('"'),
  regex(/^[^"]*/),
  char('"'),
]).map(([_, content]) => content);

// Pattern variable: ?x, ?who, ?thing-lovers
const patternVar = sequenceOf([
  char("?"),
  regex(/^[a-zA-Z][a-zA-Z0-9_\-]*/),
]).map(([_, name]) => `?${name.toUpperCase()}`);

// Lit-word: 'word (for wildcards and special literals)
const litWord = sequenceOf([
  char("'"),
  regex(/^[a-zA-Z*_][a-zA-Z0-9_\-*]*/),
]).map(([_, w]) => {
  // Special handling for wildcard
  if (w === "*" || w === "_") return "*";
  return w.toUpperCase();
});

// Wildcard: * (direct, not as lit-word)
const wildcard = char("*").map(() => "*");

// Word: alice, type, person
const word = regex(/^[a-zA-Z][a-zA-Z0-9_\-?!]*/).map(w => w.toUpperCase());

// Any value element
const element = choice([number, string, patternVar, wildcard, litWord, word]);

// ============================================================================
// Triple Structure
// ============================================================================

// A triple is just three elements: [source, attr, target]
const triple = sequenceOf([
  element,
  ws1,
  element,
  ws1,
  element,
]).map(([source, _, attr, __, target]) => [source, attr, target]);

// Object syntax: source { attr1 target1 attr2 target2 ... }
// Expands to multiple triples with same source
const objectTriples = sequenceOf([
  element,
  ws,
  char("{"),
  ws,
  many(sequenceOf([element, ws1, element, ws]).map(([a, _, t]) => [a, t])),
  char("}"),
]).map(([source, _, __, ___, pairs]) =>
  pairs.map(([attr, target]) => [source, attr, target])
);

// Either a single triple or object syntax
const tripleOrObject = choice([
  objectTriples,  // Returns array of triples
  triple.map(t => [t])  // Wrap single triple in array for consistency
]);

// Multiple triples or objects
const triples = sequenceOf([
  tripleOrObject,
  many(sequenceOf([ws, tripleOrObject]).map(([_, t]) => t)),
]).map(([first, rest]) => first.concat(...rest));  // Flatten arrays

// Block of triples: [alice type person ...]
const block = sequenceOf([
  char("["),
  ws,
  triples,
  ws,
  char("]"),
]).map(([_, __, ts]) => ts);

// Empty block: []
const emptyBlock = sequenceOf([
  char("["),
  ws,
  char("]"),
]).map(() => []);

// Block or empty
const tripleBlock = choice([block, emptyBlock]);

// ============================================================================
// Pattern Specifications (for queries and rules)
// ============================================================================

// NAC (Negative Application Condition) pattern: not ?x deleted true
const nacTriple = sequenceOf([
  str("not"),
  ws1,
  element,
  ws1,
  element,
  ws1,
  element,
]).map(([_, __, source, ___, attr, ____, target]) => ({
  nac: true,
  triples: [[source, attr, target]]
}));

// NAC with object syntax: not source { attr target ... }
const nacObject = sequenceOf([
  str("not"),
  ws1,
  element,
  ws,
  char("{"),
  ws,
  many(sequenceOf([element, ws1, element, ws]).map(([a, _, t]) => [a, t])),
  char("}"),
]).map(([_, __, source, ___, ____, _____, pairs]) => ({
  nac: true,
  triples: pairs.map(([attr, target]) => [source, attr, target])
}));

// Pattern element: regular triple/object or NAC
const patternElement = choice([
  nacObject,
  nacTriple,
  objectTriples.map(ts => ({ nac: false, triples: ts })),
  triple.map(t => ({ nac: false, triples: [t] }))
]);

// Pattern spec: sequence of pattern elements
const patternSpec = sequenceOf([
  char("["),
  ws,
  patternElement,
  many(sequenceOf([ws, patternElement]).map(([_, p]) => p)),
  ws,
  char("]"),
]).map(([_, __, first, rest]) => {
  const all = [first, ...rest];
  const patterns = [];
  const nac = [];

  for (const elem of all) {
    if (elem.nac) {
      nac.push(...elem.triples);
    } else {
      patterns.push(...elem.triples);
    }
  }

  return { patterns, nac };
});

// ============================================================================
// Commands (special word handling like parser.js)
// ============================================================================

// fact [triples...]
const factCommand = sequenceOf([
  str("fact"),
  ws,
  tripleBlock,
]).map(([_, __, triples]) => ({
  type: "fact",
  triples,
}));

// query [patterns...]
const queryCommand = sequenceOf([
  str("query"),
  ws,
  patternSpec,
]).map(([_, __, spec]) => ({
  type: "query",
  patterns: spec.patterns,
  nac: spec.nac,
}));

// rule name [match...] -> [produce...]
const ruleCommand = sequenceOf([
  str("rule"),
  ws1,
  word,
  ws,
  patternSpec,
  ws,
  str("->"),
  ws,
  patternSpec,
]).map(([_, __, name, ___, matchSpec, ____, _____, ______, produceSpec]) => ({
  type: "rule",
  name,
  match: matchSpec.patterns,
  matchNac: matchSpec.nac,
  produce: produceSpec.patterns,
  produceNac: produceSpec.nac,
}));

// pattern name [patterns...]
const patternCommand = sequenceOf([
  str("pattern"),
  ws1,
  word,
  ws,
  patternSpec,
]).map(([_, __, name, ___, spec]) => ({
  type: "pattern",
  name,
  patterns: spec.patterns,
  nac: spec.nac,
}));

// watch [match...] [action...]
const watchCommand = sequenceOf([
  str("watch"),
  ws,
  patternSpec,
  ws,
  patternSpec,
]).map(([_, __, matchSpec, ___, actionSpec]) => ({
  type: "watch",
  match: matchSpec.patterns,
  matchNac: matchSpec.nac,
  action: actionSpec.patterns,
  actionNac: actionSpec.nac,
}));

// delete source attr target
const deleteCommand = sequenceOf([
  str("delete"),
  ws1,
  element,
  ws1,
  element,
  ws1,
  element,
]).map(([_, __, source, ___, attr, ____, target]) => ({
  type: "delete",
  triple: [source, attr, target],
}));

// clear-graph
const clearCommand = sequenceOf([
  str("clear-graph"),
]).map(() => ({
  type: "clear",
}));

// graph-info
const infoCommand = sequenceOf([
  str("graph-info"),
]).map(() => ({
  type: "info",
}));

// Any command
const command = choice([
  factCommand,
  queryCommand,
  ruleCommand,
  patternCommand,
  watchCommand,
  deleteCommand,
  clearCommand,
  infoCommand,
]);

// ============================================================================
// Program Structure
// ============================================================================

// A program is a sequence of commands
const program = sequenceOf([
  ws,
  many(sequenceOf([command, ws]).map(([cmd]) => cmd)),
]).map(([_, commands]) => ({
  type: "program",
  commands,
}));

// ============================================================================
// Exports
// ============================================================================

/**
 * Parse a pattern DSL program
 */
export function parsePattern(input) {
  const result = program.run(input);
  if (result.isError) {
    throw new Error(`Parse error at position ${result.index}: ${result.error}`);
  }
  return result.result;
}

/**
 * Parse a single pattern specification (for testing)
 */
export function parsePatternSpec(input) {
  const wrapped = `[${input}]`;
  const result = patternSpec.run(wrapped);
  if (result.isError) {
    throw new Error(`Parse error at position ${result.index}: ${result.error}`);
  }
  // For backward compatibility, if no NAC patterns, return just the patterns array
  if (result.result.nac.length === 0) {
    return result.result.patterns;
  }
  return result.result;
}

// Export parsers for testing
export {
  number,
  string,
  word,
  patternVar,
  litWord,
  element,
  triple,
  tripleBlock,
  patternSpec,
  command,
  program,
};