import { bl } from "../../index.js";

const { gadgetProto } = bl();

export function transformStep(current, input) {
    const { validateInput, fn, onError } = current;
    const validated = validateInput.call(this, input);
    if (validated === undefined) return;
    try {
        const result = fn.call(this, validated);
        this.emit({ computed: result });
    } catch (error) {
        onError.call(this, error, validated);
    }
}

export const functionProto = Object.create(gadgetProto);
Object.assign(functionProto, {
    pkg: "core.functions",
    onError(error, inputs) {
        this.emit({ failed: { input: inputs, error: error } });
    },
    validateInput(input) {
        return input;
    },
    isReady(args) {
        const { requiredKeys } = this.current();
        return requiredKeys.every((key) => args[key] !== undefined);
    },
});

export function Transform(
    {
        fn,
        validateInput,
        onError,
    },
) {
    if (typeof fn !== "function") {
        throw new Error("Transform must be a function");
    }
    if (fn.length !== 1) {
        throw new Error("Transform must take one argument");
    }
    this.step = transformStep.bind(this);
    this.fn = fn;
    if (validateInput) this.validateInput = validateInput;
    if (onError) this.onError = onError;
    return this;
}
Transform.prototype = functionProto;

export function asFunctionArgs(input) {
    if (input instanceof Object) {
        return Object.fromEntries(
            Object.entries(input).filter(([key, value]) =>
                this.requiredKeys.includes(key) && value !== undefined
            ),
        );
    }
    if (Array.isArray(input) && input.length === 2) {
        if (this.requiredKeys.includes(input[0])) {
            return { [input[0]]: input[1] };
        }
    }
    return undefined;
}

export function partialStep(current, input) {
    const validated = this.validateInput(input);
    if (validated === undefined) return;
    const args = { ...current.args };
    const updatedKeys = [];
    for (const [key, value] of Object.entries(validated)) {
        if (args[key] === value) continue;
        args[key] = value;
        updatedKeys.push(key);
    }
    if (this.isReady(args) && updatedKeys.length > 0) {
        try {
            const result = this.fn(args);
            this.update({ ...current, args, result });
            this.emit({ computed: result });
        } catch (error) {
            this.onError(error, args);
        }
    } else {
        this.update({ ...current, args });
    }
}

export function Partial(
    {
        fn,
        requiredKeys,
        validateInput,
        onError,
        isReady,
    },
) {
    if (typeof fn === undefined) {
        throw new Error("fn must be provided");
    }
    if (typeof fn !== "function") {
        throw new Error("fn must be a function");
    }
    if (fn.length !== 1) {
        throw new Error("Partial must take one argument");
    }
    this.step = partialStep.bind(this);
    this.fn = fn;
    if (requiredKeys) this.requiredKeys = requiredKeys;
    if (validateInput) this.validateInput = validateInput;
    if (onError) this.onError = onError;
    if (isReady) this.isReady = isReady;
    this.update({ args: {}, result: undefined });
}
Partial.prototype = functionProto;

export default {
    gadgets: {
        Transform,
        Partial,
    },
};
