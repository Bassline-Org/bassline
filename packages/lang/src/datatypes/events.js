import { native } from "./functions.js";
import { evalNext, ex } from "../evaluator.js";
import { Block, Word } from "./core.js";

export class Emitter extends EventTarget {
    constructor() {
        super();
    }

    // We don't use the normalize function, because custom event types are strings in javascript
    normalizeEvent(event) {
        if (event instanceof Word) {
            return event.spelling.description;
        }
        if (typeof event === "string") {
            return event.trim().toUpperCase();
        }
        throw new Error("Invalid event name");
    }

    emit(event, data) {
        const normalizedEvent = this.normalizeEvent(event);
        this.dispatchEvent(new CustomEvent(normalizedEvent, { detail: data }));
    }

    on(event, callback) {
        const normalizedEvent = this.normalizeEvent(event);
        const listener = (event) => {
            callback(event.detail);
        };
        this.addEventListener(normalizedEvent, listener);
        return () => {
            this.removeEventListener(normalizedEvent, listener);
        };
    }
}

export function installEvents(context) {
    context.set(
        "emitter",
        native(async (_stream, _context) => {
            return new Emitter();
        }, {
            doc: "Creates a new event emitter.",
            args: new Block([]),
        }),
    );
    context.set(
        "emitter?",
        native(async (stream, context) => {
            const emitter = await evalNext(stream, context);
            return emitter instanceof Emitter;
        }, {
            doc: "Checks if the value is an emitter.",
            args: new Block(["value"]),
        }),
    );

    context.set(
        "emit",
        native(async (stream, context) => {
            const emitter = await evalNext(stream, context);
            const event = await evalNext(stream, context);
            const data = await evalNext(stream, context);
            emitter.emit(event, data);
        }),
    );

    context.set(
        "on",
        native(async (stream, context) => {
            const emitter = await evalNext(stream, context);
            const event = await evalNext(stream, context);
            const fn = await evalNext(stream, context);
            if (!(emitter instanceof Emitter)) {
                throw new Error("on expects an emitter");
            }
            const cleanup = emitter.on(
                event,
                async (data) => {
                    await ex(context, new Block([fn, data]));
                },
            );
            return native(async (_stream, _context) => {
                return cleanup();
            });
        }, {
            doc: "Adds an event listener to the emitter.",
            args: new Block(["emitter", "event", "fn"]),
        }),
    );
}
