import { bl } from "../../index.js";
const { gadgetProto } = bl();

export const refProto = Object.create(gadgetProto);
Object.assign(refProto, {
    step(state, input) {
        if (this.shouldResolve(input)) {
            console.log("resolving", input);
            this.resolve(input);
        }
    },
    shouldResolve(_input) {
        const { resolved } = this.current() || {};
        if (resolved) return false;
        return true;
    },
    afterSpawn(input) {
        this.receive(input);
    },
    error(error, input) {
        console.error("Error in ref", error, input);
        this.emit({ error: { input, error } });
    },
    toSpec() {
        return {
            pkg: this.pkg,
            name: this.name,
            state: this.minState(),
        };
    },
});

export async function withRetry(
    fn,
    attempts = 10,
    delay = 1000,
) {
    if (attempts === 0) {
        throw new Error("Retry failed");
    }
    const result = await fn();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, delay * attempts));
    return withRetry(fn, attempts - 1, delay);
}
