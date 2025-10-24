import { evaluate } from "../../evaluator.js";
import { normalizeString } from "../../utils.js";
//import { Datatype, Str, unset, Value } from "./core.js";
import { NativeFn, NativeMethod } from "./functions.js";

export class Task extends Value {
    static type = normalizeString("task!");
    constructor(promise) {
        super();
        if (promise) {
            this._status = "pending";
            this.value = Promise.resolve(promise);
        } else {
            const { promise, resolve, reject } = Promise.withResolvers();
            this._status = "not-scheduled";
            this.value = promise;
            this.resolve = resolve;
            this.reject = reject;
        }
        this.value.then((value) => {
            this._status = "complete";
        });
    }

    after(block, context) {
        const task = new Task(this.value.then(async () => {
            return await evaluate(block, context);
        }));
        return task;
    }

    schedule() {
        this?.resolve?.();
    }

    status() {
        return new Str(this._status);
    }

    form() {
        return new Str(`task! status: ${this._status}`);
    }

    mold() {
        return new Str(`(make task!)`);
    }

    static make(stream, context) {
        return new Task();
    }
}

export default {
    "task!": new Datatype(Task),
    "after": NativeMethod.ternary("after"),
    "schedule": NativeMethod.unary("schedule"),
    "status": NativeMethod.unary("status"),
    "sleep": new NativeFn(["ms"], ([ms], stream, context) => {
        const task = new Task();

        setTimeout(() => {
            task.resolve(unset);
        }, ms.value);

        return task;
    }),
};
