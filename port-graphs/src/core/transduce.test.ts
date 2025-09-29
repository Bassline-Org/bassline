import { describe, it, expect } from 'vitest';
import {
    map,
    filter,
    comp,
    take,
    gadget,
    statefulGadget,
    statelessProcess,
    externalProcess
} from './transduce';

describe('transducers', () => {
    it('map transforms values', () => {
        const double = map((x: number) => x * 2);
        const step = double((acc: number, val: number) => acc + val);

        expect(step(0, 5)).toBe(10);
        expect(step(10, 3)).toBe(16);
    });

    it('filter only passes matching values', () => {
        const positive = filter((x: number) => x > 0);
        const step = positive((acc: number, val: number) => acc + val);

        expect(step(0, 5)).toBe(5);
        expect(step(5, -3)).toBe(5);  // filtered out
        expect(step(5, 2)).toBe(7);
    });

    it('comp composes transducers left-to-right', () => {
        const xform = comp(
            filter((x: number) => x > 0),
            map((x: number) => x * 2)
        );
        const step = xform((acc: number, val: number) => acc + val);

        expect(step(0, 5)).toBe(10);   // 5 * 2
        expect(step(10, -3)).toBe(10); // filtered
        expect(step(10, 2)).toBe(14);  // 2 * 2
    });

    it('take limits number of values', () => {
        const take2 = take<number>(2);
        const step = take2((acc: number, val: number) => acc + val);

        expect(step(0, 1)).toBe(1);
        expect(step(1, 2)).toBe(3);
        expect(step(3, 3)).toBe(3); // ignored after 2
    });
});

describe('gadget patterns', () => {
    it('statefulGadget maintains state', () => {
        const counter = statefulGadget(
            (acc: number, val: number) => acc + val,
            0
        );

        counter.process(5);
        expect(counter.current()).toBe(5);

        counter.process(3);
        expect(counter.current()).toBe(8);
    });

    it('statelessProcess always uses constant', () => {
        const results: number[] = [];
        const alwaysTen = gadget(
            (acc: number, val: number) => acc * val,
            statelessProcess(
                (acc: number, val: number) => acc * val,
                10,
                r => results.push(r)
            )
        );

        alwaysTen.process(2);
        alwaysTen.process(3);

        expect(results).toEqual([20, 30]);
    });

    it('externalProcess uses external state', () => {
        const store = { value: 100 };
        const external = gadget(
            (acc: number, val: number) => acc + val,
            externalProcess(
                (acc: number, val: number) => acc + val,
                () => store.value,
                (val) => { store.value = val; }
            )
        );

        external.process(50);
        expect(store.value).toBe(150);

        external.process(25);
        expect(store.value).toBe(175);
    });
});

describe('complex examples', () => {
    it('handles rich result types', () => {
        type Result =
            | { type: 'success', value: number }
            | { type: 'error' };

        const validator = statefulGadget<Result, number>(
            (acc: Result, val: number): Result => {
                if (val < 0) return { type: 'error' };
                const current = acc.type === 'success' ? acc.value : 0;
                return { type: 'success', value: current + val };
            },
            { type: 'success', value: 0 } as Result
        );

        validator.process(5);
        expect(validator.current()).toEqual({ type: 'success', value: 5 });

        validator.process(-1);
        expect(validator.current()).toEqual({ type: 'error' });
    });

    it('chains gadgets together', () => {
        const source = statefulGadget(
            (_: number, val: number) => val * 2,
            0
        );

        const sink = statefulGadget(
            (acc: number[], val: number) => [...acc, val],
            [] as number[]
        );

        // Chain by having source call sink
        const chained = statefulGadget(
            source.step,
            0,
            result => sink.process(result)
        );

        chained.process(1);
        chained.process(2);
        chained.process(3);

        expect(sink.current()).toEqual([2, 4, 6]);
    });
});

describe('transducer composition', () => {
    it('creates reusable pipelines', () => {
        const pipeline = comp(
            map((s: string) => s.trim()),
            filter((s: string) => s.length > 0),
            map((s: string) => s.toUpperCase())
        );

        const words = statefulGadget(
            pipeline((acc: string[], val: string) => [...acc, val]),
            [] as string[]
        );

        words.process('  hello  ');
        words.process('');
        words.process(' world ');

        expect(words.current()).toEqual(['HELLO', 'WORLD']);
    });

    it('same transducer different reducers', () => {
        const xform = comp(
            filter((x: number) => x > 0),
            map((x: number) => x * 2)
        );

        // Use for summing
        const summer = statefulGadget(
            xform((acc, val) => acc + val),
            0
        );

        // Use for collecting
        const collector = statefulGadget(
            xform((acc: number[], val) => [...acc, val]),
            [] as number[]
        );

        [1, -2, 3, 0, 4].forEach(n => {
            summer.process(n);
            collector.process(n);
        });

        expect(summer.current()).toBe(16); // 2 + 6 + 8
        expect(collector.current()).toEqual([2, 6, 8]);
    });
});