import { normalize } from "../../utils.js";
import { datatype, Str, Value } from "./core.js";
import { nativeFn } from "./functions.js";
import { TYPES } from "./types.js";
TYPES.task = normalize("task!");

export class Task extends Value.typed(TYPES.task) {
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
            return await block.doBlock(context);
        }));
        return task;
    }

    schedule() {
        this?.resolve?.();
        return this;
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

    static make() {
        return new Task();
    }
}

export default {
    "task!": datatype(Task),
    "after": nativeFn(
        "task block context",
        (task, block, context) => task.after(block, context),
    ),
    "schedule": nativeFn("task", (task) => task.schedule()),
    "status": nativeFn("task", (task) => task.status()),
    "sleep": nativeFn("ms", (ms) => {
        const task = new Task();
        setTimeout(() => {
            task.resolve();
        }, ms.value);
        return task;
    }),
};
