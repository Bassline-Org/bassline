import { gadgetProto } from "../../gadget.js";

export function transformStep(_current, input) {
    const validated = this.validateInput(input);
    if (validated === undefined) return;
    try {
        const result = this.fn(validated);
        this.emit({ computed: result });
    } catch (error) {
        this.onError(error, validated);
    }
}

const functionProto = Object.create(gadgetProto);
functionProto.onError = function (error, inputs) {
    this.emit({ failed: { input: inputs, error: error } });
};
functionProto.validateInput = function (input) {
    return input;
};
functionProto.requiredKeys = [];
functionProto.isReady = function (args) {
    if (this.requiredKeys.length === 0) return true;
    return this.requiredKeys.every((key) => args[key] !== undefined);
};

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
    this.step = transformStep;
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
    for (const key in validated) {
        if (args[key] === validated[key]) continue;
        args[key] = validated[key];
        updatedKeys.push(key);
    }
    if (this.isReady(args) && updatedKeys.length > 0) {
        try {
            const result = this.fn(args);
            this.update({ args, result });
            this.emit({ computed: result });
        } catch (error) {
            this.onError(error, args);
        }
    } else {
        this.update({ args, result: this.current.result });
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
    this.step = partialStep;
    this.fn = fn;
    if (requiredKeys) this.requiredKeys = requiredKeys;
    if (validateInput) this.validateInput = validateInput;
    if (onError) this.onError = onError;
    if (isReady) this.isReady = isReady;
    this.update({ args: {}, result: undefined });
}
Partial.prototype = functionProto;
