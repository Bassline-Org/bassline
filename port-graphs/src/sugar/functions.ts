import { Accepts, Implements, quick } from "../core/context";
import { Transform } from "../core/protocols";
import { transformProto } from "../patterns/functions";

type Cleanup = () => void;

interface SweetFunction<In, Out> extends Implements<Transform<In, Out>> {
    pipe(target: Accepts<Out>): Cleanup;
    pipeWith<T>(target: Accepts<T>, transform: (output: Out) => T): Cleanup;
    whenComputed(fn: (output: Out) => void): Cleanup;
    call(input: In): void;
}

function sweetenTransform<I, O>(fn: Implements<Transform<I, O>>) {
    if ('pipe' in fn) {
        return fn as SweetFunction<I, O>
    };
    return {
        ...fn,
        pipe(target) {
            return this.whenComputed((out) => {
                target.receive(out)
            });
        },
        pipeWith(target, transform) {
            return this.whenComputed((out) => {
                target.receive(transform(out))
            });
        },
        whenComputed(fn) {
            const cleanup = this.tap(({ computed }) => {
                if (computed !== undefined) {
                    fn(computed);
                }
            });
            return cleanup
        },
        call(input) {
            this.receive(input);
        }
    } as const satisfies SweetFunction<I, O>
}

export const fn = {
    map<I, O>(fn: (input: I) => O) {
        const f = quick(transformProto(fn), undefined);
        return sweetenTransform(f)
    },
}

const double = (x: number) => x * 2;
const a = fn.map(double);
a.whenComputed(res => console.log('a computed: ', res))
const b = fn.map(double);
b.whenComputed(res => console.log('b computed: ', res))
const c = fn.map(double);
a.pipe(b);
b.pipe(c);
c.whenComputed((res) => console.log('c computed: ', res));
a.call(123);