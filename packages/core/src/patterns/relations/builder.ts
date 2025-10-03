import { Accepts, Emits, Implements, quick, Valued } from "../../core";
import { unionProto, intersectionProto } from "../cells";
import { partialProto } from "../functions";
import { onChange } from "../taps";
import { computes, contributes, forward, same } from "./relate";

export function relationsBuilder() {
    const cleanups: (() => void)[] = [];
    const b = {
        same<T>(source: Implements<Valued<T>>, target: Implements<Valued<T>>) {
            const cleanup = same<T>(source, target);
            cleanups.push(cleanup);
            return b;
        },
        forward<A, B>(source: Implements<Valued<A>>, target: Implements<Valued<B>>, transform: (a: A) => B) {
            const cleanup = forward<A, B>(source, target, transform);
            cleanups.push(cleanup);
            return b;
        },
        contributes<K extends string, T>(target: Accepts<Partial<Record<K, T>>>, sources: Record<K, Implements<Valued<T>>>) {
            const cleanup = contributes<K, T>(target, sources);
            cleanups.push(cleanup);
            return b;
        },
        computes<A, B>(source: Emits<{ computed: A }>, target: Accepts<B>, transform?: (a: A) => B) {
            const cleanup = computes<A, B>(source, target, transform);
            cleanups.push(cleanup);
            return b;
        },
        build() {
            return () => {
                cleanups.forEach(cleanup => cleanup());
            };
        },
    }
    return b;
}

function test() {
    const unionCell = () => quick(unionProto<string>(), new Set<string>());
    const intersectionCell = () => quick(intersectionProto<string>(), new Set<string>());

    const premises = unionCell();
    const nogoods = unionCell();
    const believedPremises = intersectionCell();

    onChange(believedPremises, (val) => console.log('believedPremises', val));
    onChange(premises, (val) => console.log('premises', val));
    onChange(nogoods, (val) => console.log('nogoods', val));

    type Args = { premises: Set<string>, nogoods: Set<string> };
    const resolverFn = () => quick(
        partialProto(
            ({ nogoods, premises }: Args) => premises.difference(nogoods),
            ['premises', 'nogoods'])
        , {});
    const resolver = resolverFn();

    const cleanup = relationsBuilder()
        .contributes(resolver, { premises, nogoods })
        .computes(resolver, believedPremises)
        .build();

    premises.receive(new Set<string>(['foo', 'bar', 'baz']));
    nogoods.receive(new Set<string>(['bar', 'qux']));
}