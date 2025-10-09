import { bl } from "@bassline/core";

export const refProto = Object.create(bl().gadgetProto);
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
        this.update({ ...this.current(), ...initial });
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
            this.update(next);
            Promise.resolve(this.compute(next))
                .then((resolved) => {
                    this.resolve(resolved);
                })
                .catch((error) => {
                    this.reject(error);
                });
        } else {
            this.update(next);
        }
    },
    join(state, input) {
        return { ...state, ...input };
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

// Generic ref with configurable key fields and resolver
export const ref = Object.create(refProto);
Object.assign(ref, {
    keyFields: ["key"],
    validate(input) {
        const valid = {};
        // Collect key fields
        for (const field of this.keyFields) {
            if (input[field] !== undefined) {
                valid[field] = input[field];
            }
        }
        return Object.keys(valid).length > 0 ? valid : undefined;
    },
    enuf(state) {
        // Need all key fields
        const hasAllKeys = this.keyFields.every((f) => state[f] !== undefined);
        return hasAllKeys;
    },
    async compute(state) {
        const key = this.keyFields.length === 1
            ? state[this.keyFields[0]]
            : this.keyFields.reduce(
                (obj, f) => ({ ...obj, [f]: state[f] }),
                {},
            );
        console.log("key: ", key);
        const val = this.resolver.get
            ? await this.resolver.get(key)
            : await this.resolver(key);
        console.log("value: ", val);
        return val;
    },
    stateSpec() {
        const spec = {};
        for (const field of this.keyFields) {
            const value = this.current()[field];
            if (value !== undefined) {
                spec[field] = value;
            }
        }
        return spec;
    },
});

export function createRefType(
    {
        name,
        pkg = "@bassline/refs",
        keyFields,
        resolver,
        ...rest
    },
) {
    const refType = Object.create(ref);
    Object.assign(refType, {
        name,
        keyFields,
        pkg,
        resolver,
        ...rest,
    });
    return refType;
}
