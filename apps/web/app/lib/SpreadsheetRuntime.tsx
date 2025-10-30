import {
    CELLS as c,
    evaluate,
    evaluateAsSpreadsheet,
    parse,
    Spreadsheet,
    TYPES as t,
} from "@bassline/parser";
import { normalize } from "@bassline/parser/data";

// Ensure fn type is defined
if (!t.fn) {
    t.fn = normalize("fn!");
}

// Function constructor - creates invocable values
const fn = (body) => ({
    type: t.fn,
    value: body,
});

// Build a CPS function that evaluates `arity` arguments from the stream
const buildCpsFunction = (arity, compute) =>
    fn((rest, context, k) => {
        const { values, rest: rest2 } = rest.takeN(arity);
        const result = compute(...values);
        return k(result, rest2);
    });

// Normalize cell reference for case-insensitive lookup
function normalizeCellRef(cellRef) {
    return String(cellRef).toUpperCase();
}

/**
 * Create spreadsheet runtime functions that can be added to a context
 * These functions allow creating and manipulating spreadsheets from Bassline code
 */
export function createSpreadsheetFunctions(baseContext = {}) {
    return {
        // Basic math functions that spreadsheets might need
        ADD: buildCpsFunction(2, (a, b) => c.number(a.value + b.value)),
        MULTIPLY: buildCpsFunction(2, (a, b) => c.number(a.value * b.value)),
        SUBTRACT: buildCpsFunction(2, (a, b) => c.number(a.value - b.value)),
        DIVIDE: buildCpsFunction(2, (a, b) => c.number(a.value / b.value)),

        // Print function for debugging
        PRINT: buildCpsFunction(1, (a) => {
            console.log(a.value);
            return a;
        }),

        // Spreadsheet function - creates a spreadsheet from a block
        SPREADSHEET: fn((rest, evalContext, k) => {
            const { values, rest: rest2 } = rest.takeN(1);
            const block = values[0];
            if (block.type !== t.block) {
                throw new Error("SPREADSHEET expects a block");
            }
            // Merge base context with eval context for extended functions
            const mergedContext = { ...baseContext, ...evalContext };
            const sheet = evaluateAsSpreadsheet(block, mergedContext);
            const result = {
                type: "SPREADSHEET!",
                value: sheet,
            };
            return k(result, rest2);
        }),

        // Update a cell in a spreadsheet
        "UPDATE-CELL": buildCpsFunction(3, (sheet, cellRef, value) => {
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

        // Get a cell value from a spreadsheet
        "GET-CELL-VALUE": buildCpsFunction(2, (sheet, cellRef) => {
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

        // Get all cell values from a spreadsheet as a block
        "GET-ALL-VALUES": buildCpsFunction(1, (sheet) => {
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
}

/**
 * Create a complete spreadsheet runtime
 * This provides a context with all spreadsheet functions and an evaluate method
 */
export function createSpreadsheetRuntime() {
    const context = createSpreadsheetFunctions();

    return {
        context,
        evaluate: (code: string) => {
            try {
                const parsed = parse(code);
                return evaluate(parsed, context);
            } catch (error) {
                throw error;
            }
        },
    };
}
