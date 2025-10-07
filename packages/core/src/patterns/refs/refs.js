import { bl } from "../../index.js";
const { gadgetProto } = bl();

export const refProto = Object.create(gadgetProto);
Object.assign(refProto, {
    step(state, input) {
        if (this.shouldResolve(state, input)) {
            console.log("resolving", input);
            this.tryResolve(input)
                .then(this.onResolve)
                .catch((e) => this.onError(e, input));
        }
    },
    shouldResolve(state, input) {
        return true;
    },
    onResolve(resolved) {
        this.update({ ...this.current(), resolved });
        this.emit({ resolved });
    },
    onError(error, input) {
        console.error("Error in ref", error, input);
        this.emit({ error: { input, error } });
    },
    onSpawn(initial) {
        this.update({
            ...initial,
            ...Promise.withResolvers(),
        });
        this.receive(initial);
    },
    promise() {
        return this.current().promise;
    },
    minState() {
        const { promise, resolve, reject, ...rest } = this.current();
        return { ...rest };
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
