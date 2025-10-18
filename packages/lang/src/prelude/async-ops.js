import { Task } from "../datatypes/async.js";
import { nil } from "../datatypes/core.js";
import { NativeFn, NativeMethod } from "../datatypes/functions.js";

export default {
    "after": NativeMethod.ternary("after"),
    "schedule": NativeMethod.unary("schedule"),
    "status": NativeMethod.unary("status"),
    "sleep": new NativeFn(["ms"], ([ms], stream, context) => {
        const task = new Task();

        setTimeout(() => {
            task.resolve(nil);
        }, ms.value);

        return task;
    }),
};
