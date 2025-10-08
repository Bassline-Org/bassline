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
            this.update({ ...this.current(), ...next });

            // Get resolver for this ref type
            const resolver = this.getResolver(next);

            Promise.resolve(this.compute(next, resolver))
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
    // Override in subclasses to provide resolver
    getResolver(state) {
        return undefined;
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
    resolverField: null,
    implicitResolver: null,

    validate(input) {
        const valid = {};

        // Collect key fields
        for (const field of this.keyFields) {
            if (input[field] !== undefined) {
                valid[field] = input[field];
            }
        }

        // Collect resolver if it's an explicit field
        if (this.resolverField && input[this.resolverField] !== undefined) {
            valid[this.resolverField] = input[this.resolverField];
        }

        return Object.keys(valid).length > 0 ? valid : undefined;
    },

    enuf(state) {
        // Need all key fields
        const hasAllKeys = this.keyFields.every((f) => state[f] !== undefined);

        // And either implicit resolver or explicit resolver field
        const hasResolver = this.implicitResolver !== null ||
            (this.resolverField && state[this.resolverField] !== undefined);

        return hasAllKeys && hasResolver;
    },

    getResolver(state) {
        // Use implicit resolver if available, otherwise get from state
        return this.implicitResolver || state[this.resolverField];
    },

    async compute(state, resolver) {
        // Get the key (single field or composite)
        const key = this.keyFields.length === 1
            ? state[this.keyFields[0]]
            : this.keyFields.reduce(
                (obj, f) => ({ ...obj, [f]: state[f] }),
                {},
            );

        // Use resolver.get if available, otherwise call resolver directly
        const getValue = resolver.get ? (k) => resolver.get(k) : resolver;

        return await withRetry(() => getValue(key));
    },

    stateSpec() {
        // Only serialize key fields, not resolver
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

/**
 * Factory for creating ref types
 * @param {Object} config - Configuration
 * @param {string} config.name - Name of the ref type
 * @param {string[]} config.keyFields - Fields to accumulate (e.g., ["id"], ["name"], ["path"])
 * @param {Object|Function} config.resolver - Implicit resolver (optional)
 * @param {string} config.resolverField - Field name for explicit resolver (optional)
 * @returns {Object} A new ref prototype
 */
export function createRefType(
    { name, pkg = "@bassline/refs", keyFields, resolver, resolverField },
) {
    const refType = Object.create(ref);
    Object.assign(refType, {
        name,
        keyFields,
        pkg,
        implicitResolver: resolver
            ? (typeof resolver === "function" ? { get: resolver } : resolver)
            : null,
        resolverField: resolverField || null,
    });
    return refType;
}
