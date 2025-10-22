import { ContextChain, NativeFn, nil } from "../prelude/index.js";
import { parse } from "../parser.js";
import { evaluate } from "../evaluator.js";

export class Sock extends ContextChain {
    constructor(context) {
        super(context);
        this.opened = false;
        this.set(
            "send",
            new NativeFn(["data"], ([data], stream, context) => {
                this.sendSocket(data);
                return nil;
            }),
        );
        this.set(
            "close",
            new NativeFn([], ([], stream, context) => {
                this.closeSocket();
                return nil;
            }),
        );
        this.set(
            "open",
            new NativeFn([], ([], stream, context) => {
                this.openSocket();
                return nil;
            }),
        );
    }
    error(message) {
        const handler = this.get("error");
        if (handler !== nil) {
            const parsed = parse(`error "${message}"`);
            evaluate(parsed, this);
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
