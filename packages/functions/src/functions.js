import { bl } from "@bassline/core";

const { gadgetProto } = bl();

export function transformStep(_current, input) {
    try {
        const result = this.fn(input);
        if (result instanceof Promise) {
            result.then((result) => {
                this.emit({ computed: result });
            });
        } else {
            this.emit({ computed: result });
        }
    } catch (error) {
        this.onError(error, input);
    }
}

export const functionProto = Object.create(gadgetProto);
Object.assign(functionProto, {
    onError(error, inputs) {
        this.emit({ failed: { input: inputs, error: error } });
    },
});

export const transform = Object.create(functionProto);
Object.assign(transform, {
    step: transformStep,
    defaultState() {
        return undefined;
    },
});

export const partial = Object.create(functionProto);
Object.assign(partial, {
    step: partialStep,
    validate: asFunctionArgs,
    defaultState() {
        return { args: {} };
    },
    isReady(args) {
        return this.requiredKeys.every((key) => args[key] !== undefined);
    },
    requiredKeys: [],
    gatherArgs(input) {
        const args = { ...this.current().args };
        let updatedKeys = false;
        for (const [key, value] of Object.entries(input)) {
            if (args[key] === value) continue;
            args[key] = value;
            updatedKeys = true;
        }
        const shouldCompute = this.isReady(args) && updatedKeys;
        return { args, shouldCompute };
    },
});

export function asFunctionArgs(input) {
    if (input instanceof Object) {
        return Object.fromEntries(
            Object.entries(input).filter(([key, value]) =>
                this.requiredKeys.includes(key) && value !== undefined
            ),
        );
    }
    if (Array.isArray(input) && input.length === 2) {
        const [key, value] = input;
        if (this.requiredKeys.includes(key)) {
            return { [key]: value };
        }
    }
    return undefined;
}

export function partialStep(current, input) {
    const { args, shouldCompute } = this.gatherArgs(input);
    if (shouldCompute) {
        try {
            const result = this.fn(args);
            if (result instanceof Promise) {
                result.then((result) => {
                    this.update({ ...current, args, result });
                    this.emit({ computed: result });
                });
            } else {
                this.update({ ...current, args, result });
                this.emit({ computed: result });
            }
        } catch (error) {
            this.onError(error, input);
        }
    } else {
        this.update({ ...current, args });
    }
}
