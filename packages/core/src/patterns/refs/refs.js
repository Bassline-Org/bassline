import { bl } from "../../index.js";
const { gadgetProto } = bl();

export const refProto = Object.create(gadgetProto);
Object.assign(refProto, {
    afterSpawn(initial) {
        const { promise, resolve, reject } = Promise.withResolvers();
        this.promise = promise;
        this.resolve = resolve;
        this.reject = reject;

        this.update({ resolving: false });
        this.receive(initial);
    },
    step(state, input) {
        if (state.resolved !== undefined) return;
        if (state.resolving) return;

        const newState = { ...state, ...input };
        if (this.canResolve(newState)) {
            this.update({ ...newState, resolving: true });
            Promise.resolve(this.tryResolve(newState))
                .then((resolved) => {
                    this.update({ ...newState, resolved, resolving: false });
                    this.emit({ resolved });
                    this.resolve(resolved);
                })
                .catch((error) => {
                    this.update({ ...newState, resolving: false });
                    this.emit({ error });
                    this.reject(error);
                });
        } else {
            this.update({ ...newState });
        }
    },
    canResolve(state, input) {
        if (state.resolved !== undefined) return true;
        if (state.resolving) return true;
        return false;
    },
    minState() {
        const { resolved, ...rest } = this.current();
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
