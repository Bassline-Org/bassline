type Morphism<A, B> = (a: A) => B;

type Arrow<A = any, B = any, C = any> = (a: A, b: B) => C;
type StateOf<F> = F extends Arrow<infer State, infer Input, infer Effects> ? State : never;
type InputOf<F> = F extends Arrow<infer State, infer Input, infer Effects> ? Input : never;
type EffectsOf<F> = F extends Arrow<infer State, infer Input, infer Effects> ? Effects : never;

type Handler<F extends Arrow<any, any, any>, G extends BaseGadget<F> = BaseGadget<F>> = (this: G, effects: EffectsOf<F>) => void;

interface Store<State> {
    current(): State;
    update(updated: State): void;
}

class MemoryStore<State> implements Store<State> {
    constructor(public state: State) { }
    current() { return this.state }
    update(newState: State): void { this.state = newState }
}

abstract class BaseGadget<Step extends Arrow> {
    constructor(
        public step: Step,
        public store: Store<StateOf<Step>>,
        handler?: typeof this.handler
    ) {
        if (handler) this.setHandler(handler)
    }
    handler(effect: EffectsOf<Step>): void { throw new Error('Handler not set!') }
    setHandler(h: Handler<Step>) { this.handler = h.bind(this) }

    current() { return this.store.current() }
    update(newState: StateOf<Step>): void { this.store.update(newState) }
    abstract receive(input: InputOf<Step>): void;
}

class Gadget<Step extends Arrow> extends BaseGadget<Step> {
    taps: Handler<Step>[] = [];
    tap(tapFn: Handler<Step>): () => void {
        const cleanup = () => this.taps = this.taps.filter(e => e !== tapFn);
        if (this.taps.includes(tapFn)) {
            return cleanup
        }
        this.taps.push(tapFn.bind(this));
        return cleanup;
    }
    runTaps(effect: EffectsOf<Step>) { this.taps.forEach(tap => tap.call(this, effect)) }
    receive(input: InputOf<Step>) {
        const effects = this.step(this.current(), input);
        if (effects === undefined) return;
        this.handler(effects)
        this.runTaps(effects)
    }
}

type CellEffects<T> = {
    merge?: T,
    ignore?: {}
}

type CellArrow<T> = Arrow<T, T, CellEffects<T>>

class Cell<T> extends Gadget<CellArrow<T>> {
    handler({ merge }: EffectsOf<CellArrow<T>>) {
        if (merge !== undefined) this.update(merge);
    }
}

const maxStep = (a: number, b: number) => a > b ? { ignore: {} } : { merge: b }
function maxHandler(this: Cell<number>, effects: CellEffects<number>) {
    console.log('current is: ', this.current())
    if (effects.merge !== undefined) this.update(effects.merge)
}
class MaxCell extends Cell<number> {
    constructor(initial: number, store: Store<number> = new MemoryStore(initial)) {
        super(maxStep, store)
    }
}

const a = new MaxCell(0);
const b = new MaxCell(10);

a.tap((({ merge }) => {
    if (merge !== undefined) {
        console.log('a merged: ', merge)
        b.receive(merge)
    }
}));

b.tap(({ merge }) => {
    if (merge !== undefined) console.log('b merged!', merge)
})

a.receive(1);
a.receive(5);
a.receive(10);
a.receive(15);
a.receive(5);