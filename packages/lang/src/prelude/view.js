import { Context } from "../context.js";
import { native } from "../natives.js";
import { isa } from "../utils.js";
import { Block, Paren, Word } from "../values.js";
import { ex, evalNext } from "../evaluator.js";
import { basslineToJs } from "./helpers.js";

// Helper: Convert a value to component data structure(s)
async function resolveToComponents(value, viewContext) {
    // Already a component object
    if (value && typeof value === "object" && value.type && !isa(value, Block) && !isa(value, Paren)) {
        return [value];
    }

    // Block - parse as VIEW
    if (isa(value, Block)) {
        return await parseViewBlock(value, viewContext);
    }

    // Array (from foreach, map, etc.) - resolve each item
    if (Array.isArray(value)) {
        const results = [];
        for (const item of value) {
            const resolved = await resolveToComponents(item, viewContext);
            results.push(...resolved);
        }
        return results;
    }

    // Literal value - render as text
    const jsValue = basslineToJs(value);
    if (jsValue !== null && jsValue !== undefined) {
        return [{ type: "text", value: String(jsValue) }];
    }

    return [];
}

// Parse a block as VIEW components using the VIEW context
async function parseViewBlock(block, viewContext) {
    const components = [];
    const stream = block.stream();

    while (!stream.done()) {
        const current = stream.next();

        // Paren - evaluate in VIEW context and convert result to components
        if (isa(current, Paren)) {
            const result = await ex(viewContext, current);
            const resolved = await resolveToComponents(result, viewContext);
            components.push(...resolved);
            continue;
        }

        // Word - lookup in VIEW context and call if it's a component constructor
        if (isa(current, Word)) {
            const value = viewContext.get(current.spelling);
            if (value?.call) {
                // It's a native function - call it
                const component = await value.call(stream, viewContext);
                const resolved = await resolveToComponents(component, viewContext);
                components.push(...resolved);
            } else if (value !== undefined) {
                // It's a value reference
                const resolved = await resolveToComponents(value, viewContext);
                components.push(...resolved);
            }
            continue;
        }

        // Block - parse as nested VIEW fragment
        if (isa(current, Block)) {
            const nested = await parseViewBlock(current, viewContext);
            if (nested.length > 0) {
                components.push({
                    type: "fragment",
                    children: nested
                });
            }
            continue;
        }

        // Other values (literals) - convert to text
        const resolved = await resolveToComponents(current, viewContext);
        components.push(...resolved);
    }

    return components;
}

// Bind component constructor functions to VIEW context
function bindComponentConstructors(viewContext) {
    // text <value>
    // Render a text node
    viewContext.set("text", native(async (stream, context) => {
        const value = await evalNext(stream, context);
        const jsValue = basslineToJs(value);
        return {
            type: "text",
            value: String(jsValue ?? "")
        };
    }));

    // button <label> <action>
    // Render a button with click handler
    viewContext.set("button", native(async (stream, context) => {
        const label = await evalNext(stream, context);
        const action = stream.next(); // Keep as Bassline block for later execution

        return {
            type: "button",
            label: String(basslineToJs(label) ?? ""),
            action: action // Block to execute on click
        };
    }));

    // input <value> <on-change>
    // Render an input field
    viewContext.set("input", native(async (stream, context) => {
        const value = await evalNext(stream, context);
        const onChange = stream.next(); // Block to execute on change

        return {
            type: "input",
            value: String(basslineToJs(value) ?? ""),
            onChange: onChange
        };
    }));

    // checkbox <checked> <on-change>
    // Render a checkbox
    viewContext.set("checkbox", native(async (stream, context) => {
        const checked = await evalNext(stream, context);
        const onChange = stream.next(); // Block to execute on change

        return {
            type: "checkbox",
            checked: Boolean(basslineToJs(checked)),
            onChange: onChange
        };
    }));

    // badge <label> [variant]
    // Render a badge/tag component
    viewContext.set("badge", native(async (stream, context) => {
        const label = await evalNext(stream, context);

        // Optional variant
        let variant = "default";
        if (!stream.done()) {
            const next = stream.peek();
            // Check if next looks like another component name
            if (!isa(next, Word) || !["text", "button", "input", "checkbox", "badge", "separator", "row", "column", "panel"].includes(next.spelling.description.toLowerCase())) {
                const variantValue = await evalNext(stream, context);
                variant = String(basslineToJs(variantValue) ?? "default");
            }
        }

        return {
            type: "badge",
            label: String(basslineToJs(label) ?? ""),
            variant: variant
        };
    }));

    // separator
    // Render a horizontal line
    viewContext.set("separator", native(async (stream, context) => {
        return {
            type: "separator"
        };
    }));

    // row [children...]
    // Horizontal layout
    viewContext.set("row", native(async (stream, context) => {
        const block = stream.next();
        if (!isa(block, Block)) {
            throw new Error("row expects a block of children");
        }

        const children = await parseViewBlock(block, context);
        return {
            type: "row",
            children: children
        };
    }));

    // column [children...]
    // Vertical layout
    viewContext.set("column", native(async (stream, context) => {
        const block = stream.next();
        if (!isa(block, Block)) {
            throw new Error("column expects a block of children");
        }

        const children = await parseViewBlock(block, context);
        return {
            type: "column",
            children: children
        };
    }));

    // panel [children...]
    // Container panel
    viewContext.set("panel", native(async (stream, context) => {
        const block = stream.next();
        if (!isa(block, Block)) {
            throw new Error("panel expects a block of children");
        }

        const children = await parseViewBlock(block, context);
        return {
            type: "panel",
            children: children
        };
    }));
}

export function installView(context) {
    // view <block>
    // Create a view description from a block
    context.set("view", native(async (stream, context) => {
        const block = stream.next();

        if (!isa(block, Block)) {
            throw new Error("view expects a block");
        }

        // Create VIEW context extending parent context
        const viewContext = new Context(context);

        // Bind component constructors to VIEW context
        bindComponentConstructors(viewContext);

        // Parse the block using the VIEW context
        const components = await parseViewBlock(block, viewContext);

        return {
            type: "view",
            components: components
        };
    }));
}
