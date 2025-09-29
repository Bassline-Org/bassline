import { StateOf, InputOf, EffectsOf, SpecOf } from "./typed";

interface Gadget<Spec> {
    current(): StateOf<Spec>;
    receive(input: InputOf<Spec>): void;
    _spec?: Spec;
}

type InternalSignal<Spec = unknown> = Partial<{
    update: StateOf<Spec>;
    emit: EffectsOf<Spec>;
}>

type GadgetCore<State, Input, Signal> = {
    state: State;
    input: Input;
    signal: Signal;
    step: (state: State, input: Input) => Signal;
}

type InferCore<Fn> = Fn extends (state: infer State, input: infer Input) => infer Signal ? GadgetCore<State, Input, Signal> : never;

type MaxSignals = {
    update?: number;
    ignore?: {};
}

const maxCore = (current: number, input: number): {
    update?: number;
    ignore?: {};
} => {
    if (input > current) return { update: input };
    return { ignore: {} };
}