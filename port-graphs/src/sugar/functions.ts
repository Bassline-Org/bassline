import { Cleanup } from ".";
import { Accepts, Implements, quick } from "../core/context";
import { Transform, Valued } from "../core/protocols";
import { fallibleProto, partialProto, transformProto } from "../patterns/functions";
import { cells } from "./cells";

export interface Fannable<I, O> {
    source: SweetFunction<I, O>
    to(target: Accepts<O>): Fannable<I, O>
    toWith<T>(target: Accepts<T>, fn: (input: O) => T): Fannable<I, O>
    build(): Cleanup
}

function fanOut<I, O>(source: SweetFunction<I, O>) {
    const cleanups = [] as (() => void)[];
    return {
        source,
        to(target) {
            const cleanup = source.whenComputed((out) => {
                target.receive(out)
            });
            cleanups.push(cleanup);
            return this
        },
        toWith(target, transform) {
            const cleanup = source.whenComputed((out) => {
                target.receive(transform(out))
            });
            cleanups.push(cleanup);
            return this;
        },
        build() {
            return () => cleanups.forEach(c => c());
        }
    } as const satisfies Fannable<I, O>
}

interface SweetFunction<In, Out> {
    whenComputed(fn: (output: Out) => void): Cleanup;
    call(input: In): void;
    fanOut(): Fannable<In, Out>,
}

interface SweetFallibleFunction<In, Out> extends SweetFunction<In, Out> {
    whenError(fn: (input: In, error: string) => void): Cleanup;
}

function sweetenTransform<I, O>(fn: Implements<Transform<I, O>>) {
    if ('whenComputed' in fn) {
        return fn
    };
    return {
        ...fn,
        whenComputed(fn: (output: O) => void): Cleanup {
            const cleanup = this.tap(({ computed }) => {
                if (computed !== undefined) {
                    fn(computed);
                }
            });
            return cleanup
        },
        call(input: I) {
            this.receive(input);
        },
        fanOut() {
            return fanOut<I, O>(this)
        },
    } as const
}

export const fn = {
    map<I, O>(fn: (input: I) => O) {
        const f = quick(transformProto(fn), undefined);
        return sweetenTransform(f) as typeof f & SweetFunction<I, O>
    },
    partial<I extends Record<string, unknown>, O>(fn: (input: I) => O, keys: Array<keyof I>) {
        const f = quick(partialProto(fn, keys), { args: {}, result: undefined });
        return sweetenTransform(f) as typeof f & SweetFunction<I, O>
    },
    fallible<I, O>(fn: (input: I) => O) {
        const f = quick(fallibleProto(fn), undefined);
        return {
            ...sweetenTransform(f),
            whenError(fn) {
                const cleanup = this.tap((e) => {
                    if ('failed' in e) {
                        if (e.failed) {
                            const failure = e.failed as { input: I, error: string };
                            fn(failure.input, failure.error)
                        }
                    }
                });
                return cleanup
            }
        } as const as typeof f & SweetFallibleFunction<I, O>
    }
}

const a = fn.map((x: number) => x * 2);
const b = fn.map((x: number) => x * 3);
const c = fn.map((x: number) => x * 4);
const d = fn.map((x: string) => Number(x) * 5);

const e = fn.partial((input: { a: number, b: number }) => input.a + input.b, ['a', 'b']);
const canFail = fn.fallible((x: number): number => { throw new Error('oops') });

canFail.whenError((input, reason) => {
    console.log('failed with input: ', input, ' reason: ', reason);
});

e.whenComputed(res => {
    console.log('e: ', res)
})

a.whenComputed(res => console.log('a computed: ', res))
b.whenComputed(res => console.log('b computed: ', res))
c.whenComputed((res) => console.log('c computed: ', res));
d.whenComputed((res) => console.log('d computed: ', res));

const cleanup = a.fanOut()
    .to(b)
    .to(c)
    .toWith(d, x => String(x))
    .toWith(e, x => ({ a: x }))
    .to(canFail)
    .build();

b.fanOut()
    .toWith(e, x => ({ b: x }))
    .build();

a.call(123);

cleanup();

a.call(123);

export function derive<Arg, R>(source: Implements<Valued<Arg>>, body: (input: Arg) => R) {
    const func = fn.map(body);
    func.receive(source.current());
    return [func, source.tap(({ changed }) => changed && func.receive(changed))] as const
}

export function deriveFrom<
    Args extends Readonly<Record<string, unknown>>,
    Sources extends { [key in keyof Args]: Implements<Valued<Args[key]>> },
    R>(sources: Sources, body: (arg: Args) => R) {
    const cleanups: Array<Cleanup> = [];
    const func = fn.partial(body, Object.keys(sources));
    for (const key in sources) {
        const source = sources[key];
        cleanups.push(source.tap(({ changed }) => changed && func.receive({ [key]: changed } as Partial<Args>)));
    }
    const initial = Object.fromEntries(Object.entries(sources).map(([k, c]) => [k, c.current()])) as Partial<Args>;
    func.receive(initial);
    return [func, () => { cleanups.forEach(c => c()) }] as const
}

const foo = cells.ordinal(0);
const bar = cells.ordinal(0);

const [derived, clean] = deriveFrom({ foo, bar }, ({ foo: [, foo], bar: [, bar] }: { foo: [number, number], bar: [number, number] }) => foo + bar);
derived.whenComputed(res => console.log(res))

foo.update([2, 10]);
bar.update([3, 10]);