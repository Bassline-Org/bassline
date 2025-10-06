import { gadgetProto } from "../../gadget.js";
import { installTaps } from "../../taps.js";

installTaps();

export function mapStep(_current, input) {
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
    onError.call(this, error, inputs);
};
functionProto.validateInput = function (input) {
    return input;
};
functionProto.requiredKeys = [];
functionProto.isReady = function (args) {
    if (this.requiredKeys.length === 0) return true;
    return this.requiredKeys.every((key) => args[key] !== undefined);
};

function MapFn(
    {
        fn,
        validateInput,
        onError,
    },
) {
    if (typeof fn !== "function") throw new Error("MapFn must be a function");
    if (fn.length !== 1) throw new Error("MapFn must take one argument");
    this.step = mapStep;
    this.fn = fn;
    if (validateInput) this.validateInput = validateInput;
    if (onError) this.onError = onError;
    return this;
}
MapFn.prototype = functionProto;

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

export function PartialFn(
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
    if (fn.length !== 1) throw new Error("PartialFn must take one argument");
    this.step = partialStep;
    this.fn = fn;
    if (requiredKeys) this.requiredKeys = requiredKeys;
    if (validateInput) this.validateInput = validateInput;
    if (onError) this.onError = onError;
    if (isReady) this.isReady = isReady;
    this.update({ args: {}, result: undefined });
}
PartialFn.prototype = functionProto;

const foo = new PartialFn({
    fn(args) {
        return Object.values(args).reduce((acc, val) => acc + val, 0);
    },
});

foo.tap(({ computed, failed }) => {
    if (computed) console.log("computed", computed);
    if (failed) console.log("failed", failed);
});

foo.receive({ x: 5 });
foo.receive({ y: 3 });
foo.receive({ z: 10 });
foo.receive({ x: 10 });
foo.receive({ x: 5 });
foo.receive({ x: 5 });
