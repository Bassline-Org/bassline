import { CELLS as c, normalize, TYPES as t } from "./data.js";

// Ensure fn type is defined
if (!t.fn) {
    t.fn = normalize("fn!");
}

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
// SPREADSHEET DIALECT - Reactive incremental computation
// ============================================================================

// Normalize cell reference for case-insensitive lookup
function normalizeCellRef(cellRef) {
    return String(cellRef).toUpperCase();
}

// Reactive spreadsheet instance
export class Spreadsheet {
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
export function evaluateAsSpreadsheet(block, evalContext) {
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

export function evaluate(node, context, k) {
    const handler = evaluateSemantics[node.type] ?? evaluateSemantics.default;
    return handler(node, context, k);
}
