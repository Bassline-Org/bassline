import { native, evalValue } from "../natives.js";
import { Context } from "../context.js";
import { isa } from "../utils.js";
import { Block, Num, Str } from "../values.js";
import { evalNext } from "../evaluator.js";
import {
    createContact,
    describeContact,
    deserializeContact,
    hasCapability,
    serializeContact,
} from "../contact.js";

export function installContactOps(context) {
    // Create runtime contact automatically
    const runtimeContact = createContact(
        typeof window !== "undefined" ? "Browser REPL" : "Bassline Runtime",
        [], // No endpoints yet
        {},
    );

    // Helper to convert contact to Bassline Context
    function contactToContext(contact) {
        const contactContext = new Context();
        contactContext.set("id", new Str(contact.id));
        contactContext.set("name", new Str(contact.name));

        // Endpoints as block of strings
        const endpointsBlock = new Block(
            contact.endpoints.map((e) => new Str(e)),
        );
        contactContext.set("endpoints", endpointsBlock);

        // Capabilities as block of strings
        const capabilitiesBlock = new Block(
            contact.capabilities.map((c) => new Str(c)),
        );
        contactContext.set("capabilities", capabilitiesBlock);

        contactContext.set("timestamp", new Num(contact.timestamp));

        // Store internal reference
        contactContext._contact = contact;

        return contactContext;
    }

    // Helper to extract contact from Context
    function contextToContact(ctx) {
        if (ctx._contact) {
            return ctx._contact;
        }

        // Extract from context
        const id = ctx.get(Symbol.for("ID"));
        const name = ctx.get(Symbol.for("NAME"));
        const endpoints = ctx.get(Symbol.for("ENDPOINTS"));
        const capabilities = ctx.get(Symbol.for("CAPABILITIES"));

        return {
            id: isa(id, Str) ? id.value : String(id),
            name: isa(name, Str) ? name.value : String(name),
            endpoints: endpoints && isa(endpoints, Block)
                ? endpoints.items.map((e) => isa(e, Str) ? e.value : String(e))
                : [],
            capabilities: capabilities && isa(capabilities, Block)
                ? capabilities.items.map((c) =>
                    isa(c, Str) ? c.value : String(c)
                )
                : [],
            timestamp: Date.now(),
        };
    }

    // RUNTIME_CONTACT - global contact for this runtime
    context.set("RUNTIME_CONTACT", contactToContext(runtimeContact));

    // make-contact <name> <endpoints-block>
    // Create a new contact
    context.set(
        "make-contact",
        native(async (stream, context) => {
            const name = evalValue(stream.next(), context);
            const endpoints = await evalNext(stream, context);

            const nameStr = isa(name, Str) ? name.value : String(name);

            let endpointsArray = [];
            if (isa(endpoints, Block)) {
                endpointsArray = endpoints.items.map((e) =>
                    isa(e, Str) ? e.value : String(e)
                );
            }

            const contact = createContact(nameStr, endpointsArray);
            return contactToContext(contact);
        }),
    );

    // parse-contact <json-str>
    // Deserialize contact from JSON string
    context.set(
        "parse-contact",
        native(async (stream, context) => {
            const jsonStr = evalValue(stream.next(), context);
            const json = isa(jsonStr, Str) ? jsonStr.value : String(jsonStr);

            try {
                const contact = deserializeContact(json);
                return contactToContext(contact);
            } catch (error) {
                throw new Error(`parse-contact failed: ${error.message}`);
            }
        }),
    );

    // to-contact-json <contact>
    // Serialize contact to JSON string
    context.set(
        "to-contact-json",
        native(async (stream, context) => {
            const contactCtx = await evalNext(stream, context);

            if (!(contactCtx instanceof Context)) {
                throw new Error("to-contact-json expects a contact context");
            }

            const contact = contextToContact(contactCtx);
            const json = serializeContact(contact);
            return new Str(json);
        }),
    );

    // contact-has? <contact> <capability>
    // Check if contact has a capability
    context.set(
        "contact-has?",
        native(async (stream, context) => {
            const contactCtx = await evalNext(stream, context);
            const capability = evalValue(stream.next(), context);

            if (!(contactCtx instanceof Context)) {
                throw new Error("contact-has? expects a contact context");
            }

            const contact = contextToContact(contactCtx);
            const capStr = isa(capability, Str)
                ? capability.value
                : String(capability);
            return hasCapability(contact, capStr);
        }),
    );

    // describe-contact <contact>
    // Get human-readable description of contact
    context.set(
        "describe-contact",
        native(async (stream, context) => {
            const contactCtx = await evalNext(stream, context);

            if (!(contactCtx instanceof Context)) {
                throw new Error("describe-contact expects a contact context");
            }

            const contact = contextToContact(contactCtx);
            const description = describeContact(contact);
            return new Str(description);
        }),
    );
}
