import { Context } from "../context.js";
import { native } from "../natives.js";
import { isa } from "../utils.js";
import { Block } from "../values.js";

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

            // Create VIEW context extending parent context
            const viewContext = new Context(context);

            // Bind component constructors to VIEW context
            bindComponentConstructors(viewContext);

            // Parse the block using the VIEW context
            const components = await parseViewBlock(block, viewContext);

            return {
                type: "view",
                components: components,
            };
        }),
    );
}
