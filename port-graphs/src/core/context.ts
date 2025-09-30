type Morphism<A, B> = (a: A) => B;

type Arrow<A = any, B = any, C = any> = (a: A, b: B) => C;
type StateOf<F> = F extends Arrow<infer State, infer Input, infer Effects> ? State : never;
type InputOf<F> = F extends Arrow<infer State, infer Input, infer Effects> ? Input : never;
type EffectsOf<F> = F extends Arrow<infer State, infer Input, infer Effects> ? Effects : never;
type Handler<F extends Arrow, G extends Gadget<F> = Gadget<F>> = (this: G, effects: EffectsOf<F>) => void;

interface Store<State> {
    current(): State;
    update(updated: State): void;
}
type ProtoGadget<Step extends Arrow> = {
    step: Step
    handler: Handler<Step>
}
type Gadget<Step extends Arrow> =
    & ProtoGadget<Step>
    & Store<StateOf<Step>>
    & { receive(input: InputOf<Step>): void }

type Realize<Step extends Arrow> = (p: ProtoGadget<Step>, store: Store<StateOf<Step>>) => Gadget<Step>

function protoGadget<Step extends Arrow>(step: Step, handler: Handler<Step>): ProtoGadget<Step> {
    return {
        step,
        handler
    } as const satisfies ProtoGadget<Step>
}

function realize<Step extends Arrow>(p: ProtoGadget<Step>, store: Store<StateOf<Step>>) {
    const g = {
        receive(input) {
            const effects = g.step(g.current(), input);
            if (effects) {
                g.handler(effects)
            }
        },
        ...p,
        ...store,
    } as const satisfies Gadget<Step>;
    return g as typeof g;
}

type CellEffects<T> = {
    merge?: T,
    ignore?: {}
}
type Cell<T, E extends CellEffects<T> = CellEffects<T>> = Gadget<Arrow<T, T, E>>

const maxStep = (a: number, b: number) => a > b ? { ignore: {} } : { merge: b }
const unionStep = <T>() => (a: Set<T>, b: Set<T>) => b.isSubsetOf(a) ? { ignore: {} } : { merge: a.union(b) }
const cellHandler = <T>() => {
    return function (this: Cell<T>, effects: CellEffects<T>) {
        if (effects.merge !== undefined) this.update(effects.merge)
    }
}

const protoMax = protoGadget(
    maxStep,
    cellHandler()
)

const memoryStore = <T>(initial: T): Store<T> => {
    let state = initial;
    return {
        current: () => state,
        update: (newState) => state = newState,
    } as const satisfies Store<T>
}

const a = realize(protoMax, memoryStore(5));
const b = realize(protoMax, memoryStore(0))

console.log('a: ', a.current());
a.receive(10);
console.log('a: ', a.current());
a.receive(15);
console.log('a: ', a.current());
a.receive(5);
console.log('a: ', a.current());

// abstract class BaseGadget<Step extends Arrow> {
//     _handler: (_effect: EffectsOf<Step>) => void = (e) => { throw new Error('Handler not set!') }
//     constructor(
//         public step: Step,
//         public store: Store<StateOf<Step>>,
//         handler?: typeof this._handler
//     ) {
//         if (handler) this.handler = handler.bind(this)
//     }
//     set handler(newHandler: typeof this._handler) { this._handler = newHandler.bind(this) }
//     get handler() { return this._handler }

//     current() { return this.store.current() }
//     update(newState: StateOf<Step>): void { this.store.update(newState) }
//     abstract receive(input: InputOf<Step>): void;
// }

// class Gadget<Step extends Arrow> extends BaseGadget<Step> {
//     taps: Handler<Step>[] = [];
//     tap(tapFn: Handler<Step>): () => void {
//         const cleanup = () => this.taps = this.taps.filter(e => e !== tapFn);
//         if (this.taps.includes(tapFn)) {
//             return cleanup
//         }
//         this.taps.push(tapFn.bind(this));
//         return cleanup;
//     }
//     runTaps(effect: EffectsOf<Step>) { this.taps.forEach(tap => tap.call(this, effect)) }
//     receive(input: InputOf<Step>) {
//         const effects = this.step(this.current(), input);
//         if (effects === undefined) return;
//         this.handler(effects)
//         this.runTaps(effects)
//     }
// }

// type CellEffects<T> = {
//     merge?: T,
//     ignore?: {}
// }

// type CellArrow<T> = Arrow<T, T, CellEffects<T>>

// class Cell<T> extends Gadget<CellArrow<T>> {
//     handler({ merge }: EffectsOf<CellArrow<T>>) {
//         if (merge !== undefined) this.update(merge);
//     }
// }

// class MaxCell extends Cell<number> {
//     constructor(initial: number, store: Store<number> = new MemoryStore(initial)) {
//         super(maxStep, store)
//     }
// }

// const a = new MaxCell(0);
// const b = new MaxCell(10);

// a.tap((({ merge }) => {
//     if (merge !== undefined) {
//         console.log('a merged: ', merge)
//         b.receive(merge)
//     }
// }));

// b.tap(({ merge }) => {
//     if (merge !== undefined) console.log('b merged!', merge)
// })

// a.receive(1);
// a.receive(5);
// a.receive(10);
// a.receive(15);
// a.receive(5);