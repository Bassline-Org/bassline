import { bl } from "../../index.js";
const { gadgetProto } = bl();

export const refProto = Object.create(gadgetProto);
Object.assign(refProto, {
    afterSpawn(initial) {
        const { promise, resolve, reject } = Promise.withResolvers();
        this.promise = promise;
        this.promise
            .then((resolved) => {
                this.handleResolved(resolved);
            })
            .catch((error) => {
                this.handleError(error);
            });
        this.resolve = resolve;
        this.reject = reject;
        this.update({});
        this.receive({ ...initial });
    },
    handleResolved(resolved) {
        this.update({ ...this.current(), resolved });
        this.emit({ resolved });
    },
    handleError(error) {
        this.update({ ...this.current(), error });
        this.emit({ error });
    },
    step(state, input) {
        if (state.resolved) return;
        const next = this.join(state, input);
        if (this.enuf(next)) {
            Promise.resolve(this.compute(next))
                .then((resolved) => {
                    this.resolve(resolved);
                })
                .catch((error) => {
                    this.reject(error);
                });
        }
    },
    join(state, input) {
        return { ...input, ...state };
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
