import { parse } from "./src/parser.js";
import { CELLS as c, normalize, TYPES as t } from "./src/data.js";
const { word, getWord, setWord } = t;

t.fn = normalize("fn!");

// ============================================================================
// State Machine with Explicit Continuation Stack
// ============================================================================

// State carries everything needed to continue evaluation
// - stream: array of remaining items to evaluate
// - ctx: environment/context
// - konts: stack of continuation frames
// - dialect: semantic rules for interpreting types
function makeState(stream, ctx, konts = [], dialect = null) {
    return {
        stream: Array.isArray(stream) ? stream : [stream],
        ctx,
        konts,
        dialect: dialect ?? defaultDialect,
    };
}

// Continuation frames: { k: (value, rest, state) => nextState }
function pushKont(state, k) {
    return { ...state, konts: [...state.konts, k] };
}

function popKont(state) {
    if (state.konts.length === 0) return null;
    const [k, ...restKonts] = state.konts;
    return { k, state: { ...state, konts: restKonts } };
}

// Rest helper API - provides a clean interface for manipulating the stream
function makeRest(state) {
    return {
        // Evaluate N items from the stream
        takeN(n) {
            const values = [];
            let currentState = state;
            for (let i = 0; i < n; i++) {
                if (currentState.stream.length === 0) {
                    throw new Error(
                        `Expected ${n} arguments, got ${values.length}`,
                    );
                }
                const result = runUntilDone(currentState);
                values.push(result.value);
                currentState = makeState(
                    result.rest,
                    currentState.ctx,
                    currentState.konts,
                    currentState.dialect,
                );
            }
            return {
                values,
                rest: makeRest(currentState),
                state: currentState,
            };
        },

        // Get the raw stream array
        get stream() {
            return state.stream;
        },

        // Get the state
        get state() {
            return state;
        },
    };
}

// Default dialect - semantic rules for interpreting types
const defaultDialect = {
    semantics: {
        [t.word](state) {
            const [head, ...tail] = state.stream;
            const bound = state.ctx[head.value];
            if (!bound) {
                throw new Error(`Undefined word: ${head.value}`);
            }
            return makeState(
                [bound, ...tail],
                state.ctx,
                state.konts,
                state.dialect,
            );
        },

        [t.getWord](state) {
            const [head, ...tail] = state.stream;
            const bound = state.ctx[head.value];
            if (!bound) {
                throw new Error(`Undefined word: ${head.value}`);
            }
            // Check for continuation to resume (but don't pop yet - we'll resume it)
            if (state.konts.length > 0) {
                const kontFrame = popKont(state);
                return kontFrame.k(bound, tail, kontFrame.state);
            }
            return { value: bound, rest: tail };
        },

        [t.setWord](state) {
            const [head, ...tail] = state.stream;
            // Push continuation to assign after evaluating value
            // Capture the current state for the continuation closure
            const outerKonts = state.konts;
            return pushKont(
                makeState(tail, state.ctx, [], state.dialect),
                (val, rest, ctxState) => {
                    ctxState.ctx[head.value] = val;
                    // Resume any outer continuation from the captured state
                    if (outerKonts.length > 0) {
                        const kontFrame = popKont({
                            ...ctxState,
                            konts: outerKonts,
                        });
                        return kontFrame.k(val, rest, kontFrame.state);
                    }
                    return { value: val, rest };
                },
            );
        },

        [t.fn](state) {
            const [head, ...tail] = state.stream;
            // Invoke the function - it gets Rest API and continuation
            const rest = makeRest(
                makeState(tail, state.ctx, state.konts, state.dialect),
            );
            const outerKonts = state.konts;
            const result = head.value(rest, state.ctx, (value, nextRest) => {
                // Function finished - resume with continuation if present
                if (outerKonts.length > 0) {
                    const kontFrame = popKont({ ...state, konts: outerKonts });
                    return kontFrame.k(value, nextRest.stream, kontFrame.state);
                }
                return { value, rest: nextRest.stream };
            });

            // If function returns a state directly, continue with it
            if (result && result.stream !== undefined) {
                return result;
            }
            // Otherwise it returned a result object
            return result;
        },

        default(state) {
            const [head, ...tail] = state.stream;
            // Literal value - check for continuation
            if (state.konts.length > 0) {
                const kontFrame = popKont(state);
                return kontFrame.k(head, tail, kontFrame.state);
            }
            return { value: head, rest: tail };
        },
    },
};

// Single step of evaluation
function step(state) {
    if (state.stream.length === 0) {
        throw new Error("Cannot step: stream is empty");
    }

    const [head] = state.stream;
    const handler = state.dialect.semantics[head.type] ??
        state.dialect.semantics.default;
    return handler(state);
}

// Run until we hit a continuation or return a value
function runUntilDone(state) {
    let currentState = state;

    while (true) {
        if (!currentState || !currentState.stream) {
            throw new Error(
                `Invalid state in runUntilDone: ${
                    JSON.stringify(currentState)
                }`,
            );
        }
        if (currentState.stream.length === 0) {
            // Stream exhausted - check for continuations
            const kontFrame = popKont(currentState);
            if (kontFrame) {
                throw new Error(
                    "Stream exhausted but continuation expects a value",
                );
            }
            throw new Error("Evaluation ended without returning a value");
        }

        const result = step(currentState);

        // If step returned a result object with a value
        if (result.value !== undefined) {
            // Check if there's a continuation waiting
            const kontFrame = popKont(currentState);
            if (kontFrame) {
                // Resume continuation - it may return a new state or result
                const nextResult = kontFrame.k(
                    result.value,
                    result.rest,
                    kontFrame.state,
                );
                // If continuation returns a state, continue with it
                if (nextResult && nextResult.stream !== undefined) {
                    currentState = nextResult;
                    continue;
                }
                // Otherwise continuation returned a final result
                if (nextResult && nextResult.value !== undefined) {
                    return {
                        value: nextResult.value,
                        rest: nextResult.rest ?? [],
                        ctx: nextResult.ctx ?? kontFrame.state.ctx,
                    };
                }
                // Continuation returned something unexpected
                throw new Error(
                    `Continuation returned invalid result: ${
                        JSON.stringify(nextResult)
                    }`,
                );
            }
            // No continuation - return the result
            return {
                value: result.value,
                rest: result.rest ?? [],
                ctx: result.ctx ?? currentState.ctx,
            };
        }

        // Step returned a new state - continue
        currentState = result;
    }
}

// Function constructor - creates invocable values
const fn = (body) => ({
    type: t.fn,
    value: body, // body receives (rest, ctx, k) -> nextState
});

// ============================================================================
// Top-level evaluation
// ============================================================================

const evaluateSemantics = {
    [t.block]: (node, context, k) => {
        let result;
        let items = node.value;
        while (items.length > 0) {
            const state = makeState(items, context, [], defaultDialect);
            const evalResult = runUntilDone(state);
            items = evalResult.rest ?? [];
            result = evalResult.value;
        }
        if (k) {
            k(result, items);
        }
        return result;
    },

    [t.paren]: (node, context, k) => {
        let result;
        let items = node.value;
        while (items.length > 0) {
            const state = makeState(items, context, [], defaultDialect);
            const evalResult = runUntilDone(state);
            items = evalResult.rest;
            result = evalResult.value;
        }
        if (k) {
            k(result, items);
        }
        return result;
    },

    default: (node, context, k) => {
        throw new Error(`Invalid node type: ${node.type}`);
    },
};

function evaluate(node, context, k) {
    const handler = evaluateSemantics[node.type] ?? evaluateSemantics.default;
    return handler(node, context, k);
}

// ============================================================================
// PARSE DIALECT - Demonstrates the power of explicit state/dialects
// ============================================================================

// Parse dialect semantics - evaluates rules that match against input
const parseDialect = {
    semantics: {
        [t.word](state) {
            const [head, ...tail] = state.stream;
            const wordName = head.value;

            // Parse dialect keywords - pattern matchers
            const matchFunctions = {
                // Match one or more times
                SOME: (state) => {
                    const [head, ...tail] = state.stream;
                    const [ruleItem, ...rest] = tail;
                    if (!ruleItem) {
                        throw new Error("SOME expects a rule");
                    }

                    const input = state.ctx.input || [];
                    let inputIdx = state.ctx.inputIdx || 0;
                    const startIdx = inputIdx;

                    // Try to match at least once
                    while (inputIdx < input.length) {
                        const savedIdx = inputIdx;
                        const matchResult = matchRule(
                            ruleItem,
                            input,
                            inputIdx,
                            state.ctx,
                        );
                        if (matchResult.matched) {
                            inputIdx = matchResult.inputIdx;
                        } else {
                            inputIdx = savedIdx;
                            break;
                        }
                    }

                    if (inputIdx === startIdx) {
                        // No matches - return failure
                        return { value: false, rest: [], ctx: state.ctx };
                    }

                    return {
                        value: true,
                        rest: rest,
                        ctx: { ...state.ctx, inputIdx },
                    };
                },

                // Match zero or more times
                ANY: (state) => {
                    const [head, ...tail] = state.stream;
                    const [ruleItem, ...rest] = tail;
                    if (!ruleItem) {
                        throw new Error("ANY expects a rule");
                    }

                    const input = state.ctx.input || [];
                    let inputIdx = state.ctx.inputIdx || 0;

                    // Match as many times as possible
                    while (inputIdx < input.length) {
                        const savedIdx = inputIdx;
                        const matchResult = matchRule(
                            ruleItem,
                            input,
                            inputIdx,
                            state.ctx,
                        );
                        if (matchResult.matched) {
                            inputIdx = matchResult.inputIdx;
                        } else {
                            inputIdx = savedIdx;
                            break;
                        }
                    }

                    return {
                        value: true,
                        rest: rest,
                        ctx: { ...state.ctx, inputIdx },
                    };
                },

                // Advance input to before rule matches
                TO: (state) => {
                    const [head, ...tail] = state.stream;
                    const [ruleItem, ...rest] = tail;
                    if (!ruleItem) {
                        throw new Error("TO expects a rule");
                    }

                    const input = state.ctx.input || [];
                    let inputIdx = state.ctx.inputIdx || 0;

                    // Advance until rule matches, then consume it
                    while (inputIdx < input.length) {
                        const matchResult = matchRule(
                            ruleItem,
                            input,
                            inputIdx,
                            state.ctx,
                        );
                        if (matchResult.matched) {
                            // Found it - consume it
                            inputIdx = matchResult.inputIdx;
                            break;
                        }
                        inputIdx++;
                    }

                    return {
                        value: true,
                        rest: rest,
                        ctx: { ...state.ctx, inputIdx },
                    };
                },

                // Match zero or one time
                OPT: (state) => {
                    const [head, ...tail] = state.stream;
                    const [ruleItem, ...rest] = tail;
                    if (!ruleItem) {
                        throw new Error("OPT expects a rule");
                    }

                    const input = state.ctx.input || [];
                    let inputIdx = state.ctx.inputIdx || 0;

                    // Try to match once
                    const matchResult = matchRule(
                        ruleItem,
                        input,
                        inputIdx,
                        state.ctx,
                    );
                    if (matchResult.matched) {
                        inputIdx = matchResult.inputIdx;
                    }

                    return {
                        value: true,
                        rest: rest,
                        ctx: { ...state.ctx, inputIdx },
                    };
                },
            };

            if (matchFunctions[wordName]) {
                return matchFunctions[wordName](state);
            }

            // Not a keyword - evaluate as normal word (could be a variable/function)
            const bound = state.ctx[wordName];
            if (bound) {
                return makeState(
                    [bound, ...tail],
                    state.ctx,
                    state.konts,
                    state.dialect,
                );
            }

            // Literal word - try to match it in input
            const input = state.ctx.input || [];
            let inputIdx = state.ctx.inputIdx || 0;
            if (
                inputIdx < input.length && input[inputIdx].type === t.word &&
                input[inputIdx].value === wordName
            ) {
                return {
                    value: true,
                    rest: tail,
                    ctx: { ...state.ctx, inputIdx: inputIdx + 1 },
                };
            }

            return { value: false, rest: [], ctx: state.ctx };
        },

        // Literal values match themselves in input
        default(state) {
            const [head, ...tail] = state.stream;
            const input = state.ctx.input || [];
            let inputIdx = state.ctx.inputIdx || 0;

            if (inputIdx < input.length) {
                const inputItem = input[inputIdx];
                // Match if types match and values match
                if (head.type === inputItem.type) {
                    if (head.type === t.number || head.type === t.string) {
                        if (head.value === inputItem.value) {
                            return {
                                value: true,
                                rest: tail,
                                ctx: { ...state.ctx, inputIdx: inputIdx + 1 },
                            };
                        }
                    } else {
                        // For other types, just check type match
                        return {
                            value: true,
                            rest: tail,
                            ctx: { ...state.ctx, inputIdx: inputIdx + 1 },
                        };
                    }
                }
            }

            return { value: false, rest: [], ctx: state.ctx };
        },
    },
};

// Helper to match a single rule item against input
function matchRule(ruleItem, input, inputIdx, ctx) {
    if (inputIdx >= input.length) {
        return { matched: false, inputIdx };
    }

    // If rule is a word, check if it's a type word like "WORD!", "NUMBER!", etc.
    if (ruleItem.type === t.word) {
        const typeName = ruleItem.value;
        const inputItem = input[inputIdx];

        // Check if it matches the type
        if (
            typeName === inputItem.type ||
            (typeName === "WORD!" && inputItem.type === t.word) ||
            (typeName === "NUMBER!" && inputItem.type === t.number) ||
            (typeName === "STRING!" && inputItem.type === t.string) ||
            (typeName === "SET-WORD!" && inputItem.type === t.setWord) ||
            (typeName === "GET-WORD!" && inputItem.type === t.getWord)
        ) {
            return { matched: true, inputIdx: inputIdx + 1 };
        }
        // Type word didn't match - don't try literal matching
        return { matched: false, inputIdx };
    }

    // Otherwise match literal value
    if (ruleItem.type === input[inputIdx].type) {
        if (ruleItem.type === t.number || ruleItem.type === t.string) {
            if (ruleItem.value === input[inputIdx].value) {
                return { matched: true, inputIdx: inputIdx + 1 };
            }
        } else {
            return { matched: true, inputIdx: inputIdx + 1 };
        }
    }

    return { matched: false, inputIdx };
}

// Helper to evaluate rules block under parse dialect and check if input matches
function evaluateParseRules(rules, input) {
    const ruleState = makeState(
        rules,
        { input, inputIdx: 0 },
        [],
        parseDialect,
    );

    let currentState = ruleState;

    // Process all rules
    while (currentState.stream.length > 0) {
        const result = runUntilDone(currentState);

        // If a rule fails, parsing fails
        if (result.value === false) {
            return false;
        }

        // Continue with remaining rules
        currentState = makeState(
            result.rest,
            result.ctx || currentState.ctx,
            [],
            parseDialect,
        );
    }

    // Success if all rules matched and input fully consumed
    const finalInputIdx = currentState.ctx?.inputIdx || 0;
    return finalInputIdx === input.length;
}

// ============================================================================
// Builders for common patterns
// ============================================================================

// Build a CPS function that evaluates `arity` arguments from the stream,
// then calls `compute` with the evaluated values (cells) and continues with `k`.
const buildCpsFunction = (arity, compute) =>
    fn((rest, context, k) => {
        const { values, rest: rest2 } = rest.takeN(arity);
        const result = compute(...values);
        return k(result, rest2);
    });

const context = {
    "ADD": buildCpsFunction(2, (a, b) => c.number(a.value + b.value)),
    "PRINT": buildCpsFunction(1, (a) => {
        console.log(a.value);
        return a;
    }),
    "PARSE": buildCpsFunction(2, (input, rules) => {
        // input and rules should be blocks
        if (input.type !== t.block || rules.type !== t.block) {
            throw new Error("PARSE expects two blocks");
        }
        const success = evaluateParseRules(rules.value, input.value);
        // Return true/false - in Rebol this would be a logic! value
        // For now return as number (1 for true, 0 for false)
        return success ? c.number(1) : c.number(0);
    }),
    "SPREADSHEET": fn((rest, evalContext, k) => {
        const { values, rest: rest2 } = rest.takeN(1);
        const block = values[0];
        if (block.type !== t.block) {
            throw new Error("SPREADSHEET expects a block");
        }
        // Use the evaluation context (which may include extended functions)
        const sheet = evaluateAsSpreadsheet(block, evalContext);
        const result = {
            type: "SPREADSHEET!",
            value: sheet,
        };
        return k(result, rest2);
    }),
    "UPDATE-CELL": buildCpsFunction(3, (sheet, cellRef, value) => {
        // Update a cell in a spreadsheet
        if (sheet.type !== "SPREADSHEET!") {
            throw new Error("UPDATE-CELL expects a spreadsheet");
        }
        if (cellRef.type !== t.string && cellRef.type !== t.word) {
            throw new Error(
                "UPDATE-CELL cell reference must be string or word",
            );
        }
        // Extract cell name: string value or word value (already normalized by parser)
        const cellName = cellRef.type === t.string
            ? cellRef.value
            : String(cellRef.value).toUpperCase();
        sheet.value.setCell(cellName, value);
        return sheet;
    }),
    "GET-CELL-VALUE": buildCpsFunction(2, (sheet, cellRef) => {
        // Get a cell value from a spreadsheet
        if (sheet.type !== "SPREADSHEET!") {
            throw new Error("GET-CELL-VALUE expects a spreadsheet");
        }
        if (cellRef.type !== t.string && cellRef.type !== t.word) {
            throw new Error(
                "GET-CELL-VALUE cell reference must be string or word",
            );
        }
        // Extract cell name: string value or word value (already normalized by parser)
        const cellName = cellRef.type === t.string
            ? cellRef.value
            : String(cellRef.value).toUpperCase();
        const values = sheet.value.getValues();
        const normalizedName = normalizeCellRef(cellName);
        if (!values[normalizedName]) {
            throw new Error(`Cell ${cellName} not found`);
        }
        return values[normalizedName];
    }),
    "GET-ALL-VALUES": buildCpsFunction(1, (sheet) => {
        // Get all cell values from a spreadsheet as a block
        if (sheet.type !== "SPREADSHEET!") {
            throw new Error("GET-ALL-VALUES expects a spreadsheet");
        }
        const values = sheet.value.getValues();
        // Convert to block of [cell-name value] pairs
        const items = [];
        for (const [cellName, value] of Object.entries(values)) {
            items.push(c.string(cellName));
            items.push(value);
        }
        return c.block(items);
    }),
};

console.log("=== REGULAR EVALUATION ===");
const example = `
    foo: 123
    bar: add foo 10
    print bar
`;
const parsed = parse(example);
evaluate(parsed, context, () => {});

console.log("\n=== PARSE DIALECT DEMONSTRATION ===");
console.log(
    "This shows how dialects can completely change evaluation semantics!\n",
);

// Example 1: parse [hello world] [some word!] should return true
const example1 = parse(`
    parse [hello world] [some word!]
`);
console.log("Example 1: parse [hello world] [some word!]");
const result1 = evaluate(example1, context, () => {});
console.log("Result:", result1.value === 1 ? "true" : "false");
console.log("Expected: true\n");

// Example 2: parse [foo bar baz:] [to set-word!] should return true
const example2 = parse(`
    parse [foo bar baz:] [to set-word!]
`);
console.log("Example 2: parse [foo bar baz:] [to set-word!]");
const result2 = evaluate(example2, context, () => {});
console.log("Result:", result2.value === 1 ? "true" : "false");
console.log("Expected: true\n");

// Example 3: parse [1 2 3 hello] [any number!] should return false (hello not consumed)
const example3 = parse(`
    parse [1 2 3 hello] [any number!]
`);
console.log("Example 3: parse [1 2 3 hello] [any number!]");
const result3 = evaluate(example3, context, () => {});
console.log("Result:", result3.value === 1 ? "true" : "false");
console.log(
    "Expected: false (any number! matches but doesn't consume 'hello')\n",
);

// Example 4: parse [hello] [some word! word!] should return false (needs 2 words)
const example4 = parse(`
    parse [hello] [some word! word!]
`);
console.log("Example 4: parse [hello] [some word! word!]");
const result4 = evaluate(example4, context, () => {});
console.log("Result:", result4.value === 1 ? "true" : "false");
console.log("Expected: false\n");

console.log("=== WHY THIS IS POWERFUL ===");
console.log("- parse is a regular function callable from normal evaluation");
console.log("- It switches dialects to evaluate the rules block");
console.log(
    "- Parse dialect has different semantics (some, any, to are pattern matchers)",
);
console.log("- Same syntax, completely different meaning based on dialect");
console.log("- Easy to add new dialects (just define semantics)");
console.log("- Full control over stream evaluation");

// ============================================================================
// SPREADSHEET DIALECT - Reactive incremental computation
// ============================================================================

// Spreadsheet dialect changes block evaluation semantics:
// - Blocks become reactive spreadsheets
// - set-word! creates cells
// - Cell references trigger dependency tracking
// - Updates cascade reactively

// Normalize cell reference for case-insensitive lookup
function normalizeCellRef(cellRef) {
    return String(cellRef).toUpperCase();
}

// Reactive spreadsheet instance
class Spreadsheet {
    constructor(evalContext) {
        this.cells = {}; // cell name -> { value, formula, dependencies, dependents }
        this.dirty = new Set(); // cells that need recalculation
        this.evaluating = new Set(); // cells currently being evaluated (for cycle detection)
        this.evalContext = evalContext; // context for evaluating formulas
    }

    // Normalize cell reference
    _normalize(cellRef) {
        return normalizeCellRef(cellRef);
    }

    // Set cell value and trigger recalculation
    setCell(cellRef, value) {
        const normalized = this._normalize(cellRef);
        if (!this.cells[normalized]) {
            this.cells[normalized] = {
                formula: null,
                value: value,
                dependencies: new Set(),
                dependents: new Set(),
            };
        } else {
            const cell = this.cells[normalized];
            cell.formula = null;
            cell.value = value;
        }

        // Mark dependents as dirty and recalculate
        this.markDirty(normalized);
    }

    // Set cell formula
    setFormula(cellRef, formula) {
        const normalized = this._normalize(cellRef);
        if (!this.cells[normalized]) {
            this.cells[normalized] = {
                formula: formula,
                value: undefined,
                dependencies: new Set(),
                dependents: new Set(),
            };
        } else {
            const cell = this.cells[normalized];
            cell.formula = formula;
            cell.value = undefined;
        }

        // Recalculate this cell
        this.markDirty(normalized);
    }

    // Mark cell and all dependents as dirty
    markDirty(cellRef) {
        const normalized = this._normalize(cellRef);
        const cell = this.cells[normalized];
        if (!cell) return;

        this.dirty.add(normalized);

        // Recursively mark dependents
        for (const dependent of cell.dependents) {
            this.markDirty(dependent);
        }
    }

    // Get cell value, tracking dependencies
    getCell(cellRef, dependencyTracker) {
        const normalized = this._normalize(cellRef);
        if (dependencyTracker) {
            dependencyTracker.add(normalized);
        }

        if (!this.cells[normalized]) {
            throw new Error(`Cell ${cellRef} not found`);
        }

        const cell = this.cells[normalized];

        // If cell is dirty, recalculate it
        if (this.dirty.has(normalized) || cell.value === undefined) {
            this.recalculate(normalized, dependencyTracker);
        }

        return cell.value;
    }

    // Recalculate a cell's value from its formula
    recalculate(cellRef, dependencyTracker) {
        const normalized = this._normalize(cellRef);
        const cell = this.cells[normalized];
        if (!cell) return;

        if (this.evaluating.has(normalized)) {
            throw new Error(
                `Circular dependency detected involving cell ${cellRef}`,
            );
        }

        if (!cell.formula) {
            // Literal value, no recalculation needed
            this.dirty.delete(normalized);
            return;
        }

        this.evaluating.add(normalized);
        const sheet = this; // Capture for closure

        try {
            // Track dependencies during evaluation
            const dependencies = new Set();

            // Create context that tracks dependencies
            const sheetContext = {
                ...this.evalContext,
            };

            // Create a dialect that intercepts cell references
            const sheetDialect = {
                semantics: {
                    ...defaultDialect.semantics,
                    [t.word](state) {
                        const [head, ...tail] = state.stream;
                        const wordName = head.value;

                        // Check if this is a cell reference (normalize for case-insensitive lookup)
                        const normalizedName = normalizeCellRef(wordName);
                        if (sheet.cells.hasOwnProperty(normalizedName)) {
                            dependencies.add(normalizedName);
                            const cellValue = sheet.getCell(
                                normalizedName,
                                dependencies,
                            );
                            return { value: cellValue, rest: tail };
                        }

                        // Not a cell reference, use normal word lookup
                        return defaultDialect.semantics[t.word](state);
                    },
                },
            };

            // Evaluate formula with dependency tracking
            const formulaState = makeState(
                cell.formula.type === t.block
                    ? cell.formula.value
                    : [cell.formula],
                sheetContext,
                [],
                sheetDialect,
            );

            const result = runUntilDone(formulaState);

            // Update dependencies
            const oldDeps = cell.dependencies;
            cell.dependencies = dependencies;

            // Update reverse dependencies
            for (const dep of oldDeps) {
                if (sheet.cells[dep]) {
                    sheet.cells[dep].dependents.delete(normalized);
                }
            }
            for (const dep of dependencies) {
                if (sheet.cells[dep]) {
                    sheet.cells[dep].dependents.add(normalized);
                }
            }

            cell.value = result.value;
            this.dirty.delete(normalized);
        } finally {
            this.evaluating.delete(normalized);
        }
    }

    // Get all cell values
    getValues() {
        const values = {};
        for (const [cellRef, cell] of Object.entries(this.cells)) {
            if (this.dirty.has(cellRef) || cell.value === undefined) {
                this.recalculate(cellRef);
            }
            values[cellRef] = cell.value;
        }
        return values;
    }
}

// Spreadsheet dialect - changes block evaluation semantics
const spreadsheetDialect = {
    semantics: {
        // Start with default semantics
        ...defaultDialect.semantics,

        // Override setWord to create reactive cells
        [t.setWord](state) {
            const [head, ...tail] = state.stream;
            const cellRef = head.value;

            // Get the spreadsheet from context
            const sheet = state.ctx.SPREADSHEET;
            if (!sheet) {
                throw new Error(
                    "set-word! in spreadsheet dialect requires SPREADSHEET in context",
                );
            }

            // Collect the value/formula items until next set-word or end
            const valueItems = [];
            let i = 0;
            while (i < tail.length && tail[i].type !== t.setWord) {
                valueItems.push(tail[i]);
                i++;
            }

            // If we have items, evaluate them to get the value/formula
            if (valueItems.length === 0) {
                // No value - set to undefined
                sheet.setCell(cellRef, undefined);
            } else if (
                valueItems.length === 1 &&
                (valueItems[0].type === t.number ||
                    valueItems[0].type === t.string)
            ) {
                // Single literal value (number or string), set directly
                sheet.setCell(cellRef, valueItems[0]);
            } else {
                // Otherwise it's a formula - set as formula (will be evaluated when accessed)
                const formula = valueItems.length === 1
                    ? valueItems[0]
                    : c.block(valueItems);
                sheet.setFormula(cellRef, formula);
            }

            // Continue with remaining items (always return a state)
            const remaining = tail.slice(i);
            if (remaining.length === 0) {
                // No more items - return empty state that will be handled by runUntilDone
                return makeState([], state.ctx, state.konts, state.dialect);
            }
            return makeState(remaining, state.ctx, state.konts, state.dialect);
        },

        // Override word to resolve cell references
        [t.word](state) {
            const [head, ...tail] = state.stream;
            const wordName = head.value;

            // Check if this is a cell reference (normalize for case-insensitive lookup)
            const sheet = state.ctx.SPREADSHEET;
            if (sheet) {
                const normalizedName = normalizeCellRef(wordName);
                if (sheet.cells.hasOwnProperty(normalizedName)) {
                    const cellValue = sheet.getCell(normalizedName, null);
                    return { value: cellValue, rest: tail };
                }
            }

            // Not a cell reference, use normal word lookup
            return defaultDialect.semantics[t.word](state);
        },
    },
};

// Helper to evaluate a block as a spreadsheet
function evaluateAsSpreadsheet(block, evalContext) {
    const sheet = new Spreadsheet(evalContext);
    const sheetContext = {
        ...evalContext,
        SPREADSHEET: sheet,
    };

    // Evaluate block under spreadsheet dialect
    let currentState = makeState(
        block.value,
        sheetContext,
        [],
        spreadsheetDialect,
    );

    // Evaluate all items
    while (
        currentState && currentState.stream && currentState.stream.length > 0
    ) {
        try {
            const result = runUntilDone(currentState);

            // If result has rest, continue with it
            if (result.rest !== undefined && result.rest.length > 0) {
                currentState = makeState(
                    result.rest,
                    result.ctx || currentState.ctx,
                    [],
                    spreadsheetDialect,
                );
            } else if (
                result.stream !== undefined && result.stream.length > 0
            ) {
                currentState = result;
            } else {
                // No more items to process
                break;
            }
        } catch (e) {
            // If evaluation ended without returning a value, that's fine for spreadsheet processing
            // (we're processing side-effects, not values)
            if (
                e.message.includes("Evaluation ended without returning a value")
            ) {
                break;
            }
            throw e;
        }
    }

    return sheet;
}

// ============================================================================
// SPREADSHEET DIALECT EXAMPLE - Reactive incremental computation
// ============================================================================

console.log("\n=== SPREADSHEET DIALECT - Reactive Incremental Computation ===");
console.log(
    "This demonstrates a REAL dialect that changes block evaluation semantics!\n",
);

// Add MULTIPLY and SUBTRACT to context for complex example
const extendedContext = {
    ...context,
    "MULTIPLY": buildCpsFunction(2, (a, b) => c.number(a.value * b.value)),
    "SUBTRACT": buildCpsFunction(2, (a, b) => c.number(a.value - b.value)),
};

// Example 1: Simple reactive spreadsheet
console.log("Example 1: Simple reactive spreadsheet\n");
const spreadsheetExample1 = parse(`
    sheet: spreadsheet [
        A1: 10
        B1: 20
        C1: add A1 B1
        D1: add C1 5
    ]
    
    print "Initial values:"
    values: get-all-values sheet
    print values
    
    print "Updating A1 to 50 (case-insensitive):"
    update-cell sheet "a1" 50
    
    print "Updated values (C1 and D1 recalculated automatically):"
    values2: get-all-values sheet
    print values2
    
    print "Updating B1 to 30:"
    update-cell sheet "B1" 30
    
    print "Final values:"
    values3: get-all-values sheet
    print values3
`);

console.log("Evaluating:");
console.log("  sheet: spreadsheet [A1: 10 B1: 20 C1: add A1 B1 D1: add C1 5]");
console.log('  update-cell sheet "a1" 50  (case-insensitive!)');
console.log('  update-cell sheet "B1" 30\n');

evaluate(spreadsheetExample1, extendedContext, () => {});

// Example 2: Complex reactive spreadsheet with case-insensitive updates
console.log("\n--- Example 2: Complex Reactive Spreadsheet ---\n");
const spreadsheetExample2 = parse(`
    sheet: spreadsheet [
        Price: 100
        TaxRate: 10
        Tax: multiply Price TaxRate
        Total: add Price Tax
        Discount: 5
        FinalTotal: subtract Total Discount
    ]
    
    print "Initial values:"
    values: get-all-values sheet
    print values
    
    print "Updating Price to 200 (case-insensitive - Price/PRICE/price all work):"
    update-cell sheet "Price" 200
    
    print "Updated values (Tax, Total, FinalTotal recalculated):"
    values2: get-all-values sheet
    print values2
    
    print "Getting individual cell (case-insensitive):"
    tax-value: get-cell-value sheet "tax"
    print tax-value
    total-value: get-cell-value sheet "TOTAL"
    print total-value
`);

console.log("Evaluating:");
console.log(
    "  sheet: spreadsheet [Price: 100 TaxRate: 10 Tax: multiply Price TaxRate ...]",
);
console.log('  update-cell sheet "Price" 200  (case-insensitive!)\n');

evaluate(spreadsheetExample2, extendedContext, () => {});

console.log("\n=== KEY INSIGHTS ===");
console.log("- Spreadsheet dialect CHANGES block evaluation semantics");
console.log(
    "- set-word! creates reactive cells, not just variable assignments",
);
console.log(
    "- Cell references tracked automatically during formula evaluation",
);
console.log("- Updates trigger incremental recalculation of dependents only");
console.log("- Same code syntax, completely different runtime behavior");
console.log("- Case-insensitive: Price, PRICE, price all refer to same cell");
console.log(
    "- Language-level operations: update-cell, get-cell-value, get-all-values",
);
console.log("- This is only possible with explicit dialect control!");
