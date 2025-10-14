import { native } from "../natives.js";
import { isa } from "../utils.js";
import { Block, Word, Paren, Str, Num } from "../values.js";
import { moldValue } from "./helpers.js";

// Helper function to parse a Block into view components
function parseViewBlock(block) {
    const components = [];
    const viewStream = block.stream();
    const layoutComponents = ["row", "column", "panel"];

    while (!viewStream.done()) {
        const componentName = viewStream.next();

        if (!isa(componentName, Word)) {
            // Skip non-words (could be values)
            continue;
        }

        // Get lowercase component name (case-insensitive)
        const name = componentName.spelling.description.toLowerCase();
        const isLayoutComponent = layoutComponents.includes(name);

        // Special handling for foreach
        if (name === "foreach") {
            // foreach <collection-expr> <item-name> [template-block]
            const collectionExpr = viewStream.next();
            const itemName = viewStream.next();
            const templateBlock = viewStream.next();

            if (!isa(templateBlock, Block)) {
                throw new Error("foreach expects a block template");
            }

            // Store foreach metadata for React to expand
            components.push({
                component: "foreach",
                args: [
                    { type: "expr", code: moldValue(collectionExpr) },
                    { type: "value", value: itemName },
                    { type: "block", value: templateBlock },
                ],
                handlers: {},
            });
            continue;
        }

        // Parse component arguments and event handlers
        const args = [];
        const handlers = {};

        while (!viewStream.done()) {
            const next = viewStream.peek();

            // If it's a word that looks like a component name, stop
            if (
                isa(next, Word) &&
                [
                    "text",
                    "button",
                    "input",
                    "checkbox",
                    "badge",
                    "separator",
                    "row",
                    "column",
                    "panel",
                    "foreach",
                ].includes(
                    next.spelling.description.toLowerCase(),
                )
            ) {
                break;
            }

            const arg = viewStream.next();

            // Check for event handler keywords (on-click, on-change, etc.)
            if (
                isa(arg, Word) &&
                arg.spelling.description.toLowerCase().startsWith("on-")
            ) {
                const eventName = arg.spelling.description.toLowerCase();
                const actionBlock = viewStream.next();
                if (isa(actionBlock, Block)) {
                    // Extract inner code without block delimiters
                    const inner = actionBlock.items.map(moldValue).join(
                        " ",
                    );
                    handlers[eventName] = inner;
                }
                continue;
            }

            // Store arguments as evaluable expressions for reactivity
            if (isa(arg, Block)) {
                // For layout components, recursively parse Block args as nested views
                if (isLayoutComponent) {
                    const nestedView = {
                        type: "view",
                        components: parseViewBlock(arg),
                    };
                    args.push({ type: "view", value: nestedView });
                } else {
                    // For other components, keep as block
                    args.push({ type: "block", value: arg });
                }
            } else if (isa(arg, Paren)) {
                // Store Parens as molded code for re-evaluation on each render
                const molded = moldValue(arg);
                args.push({ type: "expr", code: molded });
            } else if (isa(arg, Word)) {
                // Store Words as references for re-evaluation on each render
                const molded = moldValue(arg);
                args.push({ type: "expr", code: molded });
            } else if (isa(arg, Str) || isa(arg, Num)) {
                // Literals are evaluated once and stored
                args.push({ type: "value", value: arg });
            } else {
                args.push({ type: "value", value: arg });
            }
        }

        components.push({
            component: name,
            args,
            handlers,
        });
    }

    return components;
}

export function installView(context) {
    // view <block>
    // Create a view description from a block
    context.set(
        "view",
        native(async (stream, context) => {
            const block = stream.next();

            if (!isa(block, Block)) {
                throw new Error("view expects a block");
            }

            // Parse the view block into a view description
            const components = parseViewBlock(block);

            return {
                type: "view",
                components,
            };
        }),
    );
}
