import { describe, it, expect } from 'vitest';
import {
    protoGadget,
    quick,
    withTaps,
    maxStep,
    mergeHandler,
    unionStep,
    intersectionStep,
    composeHandlers,
    contradictionHandler,
} from './context';

describe('context.ts - Core Functionality', () => {
    describe('maxStep cell', () => {
        it('should merge when new value is greater', () => {
            const proto = protoGadget(maxStep).handler(mergeHandler());
            const gadget = quick(proto, 0);

            gadget.receive(5);
            expect(gadget.current()).toBe(5);

            gadget.receive(3);
            expect(gadget.current()).toBe(5); // Should stay at 5

            gadget.receive(10);
            expect(gadget.current()).toBe(10);
        });
    });

    describe('unionStep cell', () => {
        it('should merge sets monotonically', () => {
            const proto = protoGadget(unionStep<number>()).handler(mergeHandler());
            const gadget = quick(proto, new Set([1, 2]));

            gadget.receive(new Set([2, 3]));
            expect(gadget.current()).toEqual(new Set([1, 2, 3]));

            gadget.receive(new Set([1]));
            expect(gadget.current()).toEqual(new Set([1, 2, 3])); // Should stay the same
        });
    });

    describe('intersectionStep cell', () => {
        it('should intersect sets', () => {
            const proto = protoGadget(intersectionStep<number>()).handler(mergeHandler());
            const gadget = quick(proto, new Set([1, 2, 3]));

            gadget.receive(new Set([2, 3, 4]));
            expect(gadget.current()).toEqual(new Set([2, 3]));

            gadget.receive(new Set([2]));
            expect(gadget.current()).toEqual(new Set([2]));
        });

        it('should emit contradiction when intersection is empty', () => {
            const effects: any[] = [];
            const handler = composeHandlers(
                mergeHandler(),
                contradictionHandler(),
                (g, e) => effects.push(e)
            );

            const proto = protoGadget(intersectionStep<number>()).handler(handler);
            const gadget = quick(proto, new Set([1, 2]));

            gadget.receive(new Set([3, 4]));

            expect(effects.some(e => 'contradiction' in e)).toBe(true);
        });
    });
});

describe('Extensions - withTaps', () => {
    it('should broadcast effects to taps', () => {
        const proto = protoGadget(maxStep).handler(mergeHandler());
        const gadget = quick(proto, 0);
        const tappable = withTaps(gadget);

        const effects: any[] = [];
        tappable.tap(e => effects.push(e));

        tappable.receive(5);

        expect(effects).toContainEqual({ merge: 5 });
        expect(gadget.current()).toBe(5);
    });

    it('should support multiple taps', () => {
        const proto = protoGadget(maxStep).handler(mergeHandler());
        const gadget = withTaps(quick(proto, 0));

        const effects1: any[] = [];
        const effects2: any[] = [];

        gadget.tap(e => effects1.push(e));
        gadget.tap(e => effects2.push(e));

        gadget.receive(5);
        gadget.receive(5);

        expect(effects1).toContainEqual({ merge: 5 });
        expect(effects2).toContainEqual({ merge: 5 });
    });

    it('should support tap cleanup', () => {
        const proto = protoGadget(maxStep).handler(mergeHandler());
        const gadget = withTaps(quick(proto, 0));

        const effects: any[] = [];
        const cleanup = gadget.tap(e => effects.push(e));

        gadget.receive(5);
        expect(effects).toHaveLength(1);

        cleanup();

        gadget.receive(10);
        expect(effects).toHaveLength(1); // Should not have received second effect
    });

    it('should be idempotent', () => {
        const proto = protoGadget(maxStep).handler(mergeHandler());
        const gadget = quick(proto, 0);

        const tappable1 = withTaps(gadget);
        const tappable2 = withTaps(tappable1);

        expect(tappable1).toBe(tappable2);
    });

    it('should observe all effects including ignore', () => {
        const proto = protoGadget(maxStep).handler(mergeHandler());
        const gadget = withTaps(quick(proto, 10));

        const effects: any[] = [];
        gadget.tap(e => effects.push(e));

        gadget.receive(5); // Should be ignored since 5 < 10

        expect(effects).toContainEqual({ ignore: {} });
    });
});

describe('Handler Composition', () => {
    it('should compose multiple handlers', () => {
        const log: string[] = [];

        const handler1 = () => log.push('handler1');
        const handler2 = () => log.push('handler2');
        const handler3 = () => log.push('handler3');

        const composed = composeHandlers(handler1, handler2, handler3);

        const proto = protoGadget(maxStep).handler(composed);
        const gadget = quick(proto, 0);

        gadget.receive(5);

        expect(log).toEqual(['handler1', 'handler2', 'handler3']);
    });
});