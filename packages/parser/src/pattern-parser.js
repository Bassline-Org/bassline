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
  possibly(char("-")),
  digits,
  possibly(sequenceOf([char("."), digits]).map(([, decimal]) => decimal)),
]).map(([sign, whole, decimal]) =>
  Number((sign ?? "") + whole + (decimal ?? ""))
);

// String: "hello world" with escape sequences
// Character inside string: either non-special char OR backslash + any char
const stringChar = choice([
  regex(/^[^"\\]/u), // Any char except quote and backslash (Unicode-aware for emojis)
  sequenceOf([char("\\"), anyChar]).map(([slash, c]) => slash + c), // Escape sequence
]);

const string = sequenceOf([
  char('"'),
  many(stringChar),
  char('"'),
]).map(([_, chars, __]) => {
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
  char("?"),
  wordChars,
]).map(([_, chars]) => {
  return {
    pattern: chars,
  };
});

const wild = char("_").map(() => {
  return {
    wild: true,
  };
});

const word = sequenceOf([
  letter.map((c) => c.toUpperCase()),
  wordChars,
]).map(([start, chars]) => {
  return {
    word: start + chars,
  };
});

const litWord = sequenceOf([
  char("'"),
  choice([patternVar, wild, word]),
]).map(([_, word]) => ({
  literal: true,
  ...word,
}));

const scalar = sequenceOf([
  ws,
  choice([number, string, wild, litWord, patternVar, word]),
]).map(([_, value]) => value);

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

const objEntry = sequenceOf([
  ws,
  scalar,
  ws,
  value,
  ws,
]).map(([_, key, __, value]) => [key, value]);

/**
 * A triple is [entity, attribute, val]
 * Entity, attribute, and val are all of type scalar
 */
const triple = sequenceOf([
  ws,
  scalar,
  ws,
  scalar,
  ws,
  scalar,
  ws,
]).map(([_, entity, __, attribute, ___, value]) => [entity, attribute, value]);

const obj = sequenceOf([
  char("{"),
  ws,
  many(
    objEntry,
  ),
  ws,
  char("}"),
]).map(([_, __, entries]) => {
  const id = { word: `obj-${crypto.randomUUID()}` };
  let triples = [];
  triples.push([id, { word: "TYPE?" }, { word: "OBJECT!" }]);
  entries.forEach(([attr, val]) => {
    if (val.type === "object" || val.type === "list") {
      triples = triples.concat(val.triples);
      triples.push([id, attr, val.id]);
    } else {
      triples.push([id, attr, val]);
    }
  });
  return {
    type: "object",
    id,
    triples,
  };
});

const list = sequenceOf([
  char("["),
  ws,
  many(
    sequenceOf([
      value,
      ws,
    ]).map(([val, _]) => val),
  ),
  char("]"),
]).map(([_, __, values]) => {
  const id = { word: `list-${crypto.randomUUID()}` };
  let triples = [];
  triples.push([id, { word: "TYPE?" }, { word: "LIST!" }]);
  values.forEach((val, index) => {
    if (val.type === "object" || val.type === "list") {
      triples = triples.concat(val.triples);
    } else {
      triples.push([id, index, val]);
    }
  });
  return {
    type: "list",
    id,
    triples,
  };
});

const commandParser = (commandName, bodyParser) => {
  const head = sequenceOf([
    ws,
    str(commandName),
    ws,
    char("{"),
  ]);
  const tail = sequenceOf([
    ws,
    char("}"),
  ]);
  return sequenceOf([
    head,
    bodyParser,
    tail,
  ]).map(([_, body]) => body);
};

const insert = commandParser(
  "insert",
  many(objEntry)
    .map((entries) => {
      let triples = [];
      const root = { word: "root" };
      entries.forEach(([attr, val]) => {
        if (val.type === "object" || val.type === "list") {
          triples = triples.concat(val.triples);
          triples.push([root, attr, val.id]);
        } else {
          triples.push([root, attr, val]);
        }
      });
      return { insert: triples };
    }),
);

const where = commandParser(
  "where",
  many(triple).map((triples) => ({ where: triples })),
);
const not = commandParser(
  "not",
  many(triple).map((triples) => ({ not: triples })),
);

const query = commandParser(
  "query",
  sequenceOf([
    where,
    not,
  ]).map(([where, not]) => {
    return {
      where: where.where,
      not: not?.not ?? [],
    };
  }),
);

const ruleHead = sequenceOf([
  ws,
  str("rule"),
  ws,
  wordChars,
  ws,
  char("{"),
]).map((results) => results[3]);

const rule = sequenceOf([
  ruleHead,
  where,
  possibly(not),
  insert,
  ws,
  char("}"),
]).map(([name, where, not, insert]) => ({
  rule: {
    name,
    ...where,
    ...(not ?? {}),
    ...insert,
  },
}));

const command = choice([
  insert,
  query,
  rule,
]);

const program = many(command);

// // Either a single triple or object syntax
// const tripleOrObject = choice([
//   objectTriples, // Returns array of triples
//   triple.map((t) => [t]), // Wrap single triple in array for consistency
// ]);

// // Multiple triples or objects
// const triples = sequenceOf([
//   tripleOrObject,
//   many(sequenceOf([ws, tripleOrObject]).map(([_, t]) => t)),
// ]).map(([first, rest]) => first.concat(...rest)); // Flatten arrays

// // Block of triples: [alice type person ...]
// const block = sequenceOf([
//   char("["),
//   ws,
//   triples,
//   ws,
//   char("]"),
// ]).map(([_, __, ts]) => ts);

// // Empty block: []
// const emptyBlock = sequenceOf([
//   char("["),
//   ws,
//   char("]"),
// ]).map(() => []);

// // Block or empty
// const tripleBlock = choice([block, emptyBlock]);

// // ============================================================================
// // Pattern Specifications (for queries and rules)
// // ============================================================================

// // NAC (Negative Application Condition) pattern: not ?x deleted true
// const nacTriple = sequenceOf([
//   str("not"),
//   ws1,
//   element,
//   ws1,
//   element,
//   ws1,
//   element,
// ]).map(([_, __, source, ___, attr, ____, target]) => ({
//   nac: true,
//   triples: [[source, attr, target]],
// }));

// // NAC with object syntax: not source { attr target ... }
// const nacObject = sequenceOf([
//   str("not"),
//   ws1,
//   element,
//   ws,
//   char("{"),
//   ws,
//   many(sequenceOf([element, ws1, element, ws]).map(([a, _, t]) => [a, t])),
//   char("}"),
// ]).map(([_, __, source, ___, ____, _____, pairs]) => ({
//   nac: true,
//   triples: pairs.map(([attr, target]) => [source, attr, target]),
// }));

// // Pattern element: regular triple/object or NAC
// const patternElement = choice([
//   nacObject,
//   nacTriple,
//   objectTriples.map((ts) => ({ nac: false, triples: ts })),
//   triple.map((t) => ({ nac: false, triples: [t] })),
// ]);

// // Pattern spec with inline NAC syntax (no pipes needed - just "not" prefix)
// const patternSpec = sequenceOf([
//   char("["),
//   ws,
//   // Parse mixed patterns and NAC inline
//   many(
//     sequenceOf([
//       patternElement,
//       ws,
//     ]).map(([elem]) => elem),
//   ),
//   char("]"),
// ]).map(([_, __, elements, ___]) => {
//   const patterns = [];
//   const nac = [];

//   for (const elem of elements) {
//     if (elem.nac) {
//       nac.push(...elem.triples);
//     } else {
//       patterns.push(...elem.triples);
//     }
//   }

//   return { patterns, nac };
// });

// // ============================================================================
// // Commands (special word handling like parser.js)
// // ============================================================================

// // fact [triples...]
// const factCommand = sequenceOf([
//   str("fact"),
//   ws,
//   tripleBlock,
// ]).map(([_, __, triples]) => ({
//   type: "fact",
//   triples,
// }));

// // query [patterns...]
// const queryCommand = sequenceOf([
//   str("query"),
//   ws,
//   patternSpec,
// ]).map(([_, __, spec]) => {
//   const result = {
//     type: "query",
//     patterns: spec.patterns,
//   };
//   // Only add nac field if there are NAC patterns
//   if (spec.nac && spec.nac.length > 0) {
//     result.nac = spec.nac;
//   }
//   return result;
// });

// // rule name [match...] -> [produce...]
// const ruleCommand = sequenceOf([
//   str("rule"),
//   ws1,
//   word,
//   ws,
//   patternSpec,
//   ws,
//   str("->"),
//   ws,
//   patternSpec,
// ]).map(([_, __, name, ___, matchSpec, ____, _____, ______, produceSpec]) => {
//   const result = {
//     type: "rule",
//     name,
//     match: matchSpec.patterns,
//     produce: produceSpec.patterns,
//   };
//   // Always add NAC fields for consistency with NAC tests
//   // But only if either has NAC patterns
//   if (
//     (matchSpec.nac && matchSpec.nac.length > 0) ||
//     (produceSpec.nac && produceSpec.nac.length > 0)
//   ) {
//     result.matchNac = matchSpec.nac || [];
//     result.produceNac = produceSpec.nac || [];
//   }
//   return result;
// });

// // pattern name [patterns...]
// const patternCommand = sequenceOf([
//   str("pattern"),
//   ws1,
//   word,
//   ws,
//   patternSpec,
// ]).map(([_, __, name, ___, spec]) => {
//   const result = {
//     type: "pattern",
//     name,
//     patterns: spec.patterns,
//   };
//   // Only add nac field if there are NAC patterns
//   if (spec.nac && spec.nac.length > 0) {
//     result.nac = spec.nac;
//   }
//   return result;
// });

// // watch [match...] [action...]
// const watchCommand = sequenceOf([
//   str("watch"),
//   ws,
//   patternSpec,
//   ws,
//   patternSpec,
// ]).map(([_, __, matchSpec, ___, actionSpec]) => {
//   const result = {
//     type: "watch",
//     match: matchSpec.patterns,
//     action: actionSpec.patterns,
//   };
//   // Always add NAC fields for consistency with NAC tests
//   // But only if either has NAC patterns
//   if (
//     (matchSpec.nac && matchSpec.nac.length > 0) ||
//     (actionSpec.nac && actionSpec.nac.length > 0)
//   ) {
//     result.matchNac = matchSpec.nac || [];
//     result.actionNac = actionSpec.nac || [];
//   }
//   return result;
// });

// // delete source attr target
// const deleteCommand = sequenceOf([
//   str("delete"),
//   ws1,
//   element,
//   ws1,
//   element,
//   ws1,
//   element,
// ]).map(([_, __, source, ___, attr, ____, target]) => ({
//   type: "delete",
//   triple: [source, attr, target],
// }));

// // clear-graph
// const clearCommand = sequenceOf([
//   str("clear-graph"),
// ]).map(() => ({
//   type: "clear",
// }));

// // graph-info
// const infoCommand = sequenceOf([
//   str("graph-info"),
// ]).map(() => ({
//   type: "info",
// }));

// // Any command
// const command = choice([
//   factCommand,
//   queryCommand,
//   ruleCommand,
//   patternCommand,
//   watchCommand,
//   deleteCommand,
//   clearCommand,
//   infoCommand,
// ]);

// // ============================================================================
// // Program Structure
// // ============================================================================

// // A program is a sequence of commands
// const program = sequenceOf([
//   ws,
//   many(sequenceOf([command, ws]).map(([cmd]) => cmd)),
// ]).map(([_, commands]) => ({
//   type: "program",
//   commands,
// }));

// // ============================================================================
// // Exports
// // ============================================================================

// /**
//  * Parse a pattern DSL program
//  */
// export function parsePattern(input) {
//   const result = program.run(input);
//   if (result.isError) {
//     throw new Error(`Parse error at position ${result.index}: ${result.error}`);
//   }
//   return result.result;
// }

// /**
//  * Parse a single pattern specification (for testing)
//  */
// export function parsePatternSpec(input) {
//   const wrapped = `[${input}]`;
//   const result = patternSpec.run(wrapped);
//   if (result.isError) {
//     throw new Error(`Parse error at position ${result.index}: ${result.error}`);
//   }
//   // For backward compatibility, if no NAC patterns, return just the patterns array
//   if (result.result.nac.length === 0) {
//     return result.result.patterns;
//   }
//   return result.result;
// }

// // Export parsers for testing
// export {
//   command,
//   element,
//   litWord,
//   number,
//   patternSpec,
//   patternVar,
//   program,
//   string,
//   triple,
//   tripleBlock,
//   word,
// };

const input = `
  insert {
    foo 123
    bar [1 2 3]
  }

  query {
    where {
      ?x type type!
    }
    not {
      ?x name foo
    }
  }

  rule foo {
    where {
      ?x type type!
    }
    not {
      ?x name foo
    }
    insert {
      ?x {
      name foo
}
    }
  }
`;

const result = program.run(input);

for (const { insert, query, rule } of result.result) {
  if (insert) {
    console.log("insert: ", insert);
  }
  if (query) {
    console.log("query: ", query);
  }
  if (rule) {
    const { name, where, not, insert } = rule;
    console.log("rule: ", name);
    console.log("where: ", where);
    console.log("not: ", not);
    console.log("insert: ", insert);
  }
}

console.log("isError: ", result.isError);
console.log("error: ", result.error);
console.log("remaining: ", input.substring(result.index, input.length));
console.log("remaining length: ", input.length - result.index);
