import { context, functions } from "../prelude/index.js";
import { parse } from "../parser.js";

const { ContextChain } = context;
const { nativeFn } = functions;
export class Sock extends ContextChain {
    constructor(context) {
        super(context);
        this.opened = false;
        this.set(
            "send",
            nativeFn("data", (data) => {
                this.sendSocket(data);
                return this;
            }),
        );
        this.set(
            "close",
            nativeFn("", () => {
                this.closeSocket();
                return this;
            }),
        );
        this.set(
            "open",
            nativeFn("", () => {
                this.openSocket();
                return this;
            }),
        );
    }
    error(message) {
        // Maybe call the handler Handler
        if (this.has("error")) {
            const parsed = parse(`error "${message}"`);
            parsed.doBlock(this);
        } else {
            console.error(message);
        }
    }
    openSocket() {
        if (this.opened) return;
        try {
            this.open();
            this.opened = true;
        } catch (error) {
            this.error(error);
        }
    }

    closeSocket() {
        if (!this.opened) return;
        try {
            this.close();
            this.opened = false;
        } catch (error) {
            this.error(error);
        }
    }
    sendSocket(data) {
        if (!this.opened) return;
        try {
            this.send(data);
        } catch (error) {
            this.error(error);
        }
    }
}
