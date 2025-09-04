// This file implements the pool mechanism for bassline
// A pool is an assertion set over wants & services
// This is how we internally handle our connections between gadgets
// So when a gadget spawns, it can communicate with the pool of what it needs,
// and then other gadgets can satisfy those needs. After which the gadget can offer
// its services to the pool. This is what a connection is in our system.
// 
// A gadget can be in many different pools at once, and offer different services
// Conceptually you can consider this the semantic matching layer between gadgets
// You can consider wants as input ports
// and services as output ports.
//
// These assertions can be retracted, and new ones can be asserted.
// This is how we handle connections for functions & cells. Since when a function has a need met, it retracts
// it's want. Whereas a cell will not retract it's want, because it can handle many connections.
//
// NOTE: This is ONLY FOR SEMANTICS! Raw data is not put into pools, only tags & properties.

import * as _ from 'lodash';

interface IAssertion<T> extends Record<string, any> {
    id: string,
    kind: 'need' | 'have',
    tag: T,
    source: string, // the id of the gadget that made the assertion
}

interface INeed<T> extends IAssertion<T> { kind: 'need' }
interface IHave<T> extends IAssertion<T> { kind: 'have' }
export function need<T>(obj: { tag: T, source: string }): INeed<T> {
    return {
        ...obj,
        kind: 'need',
        id: _.uniqueId(),
    }
}
export function have<T>(obj: { tag: T, source: string }): IHave<T> {
    return {
        ...obj,
        kind: 'have',
        id: _.uniqueId(),
    }
}

export interface IPool {
    id: string,
    need: Set<INeed<any>>;
    have: Set<IHave<any>>;
}

export class Pool<Tags> extends EventTarget implements IPool {
    need: Set<INeed<keyof Tags>> = new Set();
    have: Set<IHave<keyof Tags>> = new Set();

    constructor(public readonly id: string) {
        super();
    }

    assert(assertion: IAssertion<keyof Tags>): void {
        if (assertion.kind === 'need') {
            this.need.add(assertion as INeed<keyof Tags>);
            this.dispatchEvent(new CustomEvent('needAdded', { detail: assertion }));
            return;
        }
        if (assertion.kind === 'have') {
            this.have.add(assertion as IHave<keyof Tags>);
            this.dispatchEvent(new CustomEvent('haveAdded', { detail: assertion}));
            return;
        }
        throw new Error('Invalid assertion!');
    }

    describe(source: string): { need: INeed<keyof Tags>[], have: IHave<keyof Tags>[] } {
        return {
            need: Array.from(this.need).filter(n => n.source === source),
            have: Array.from(this.have).filter(h => h.source === source),
        };
    }

    retract(assertion: IAssertion<keyof Tags>): void {
        if (assertion.kind === 'need') {
            this.need.delete(assertion as INeed<keyof Tags>);
            this.dispatchEvent(new CustomEvent('needRemoved', { detail: assertion }));
            return;
        }
        if (assertion.kind === 'have') {
            this.have.delete(assertion as IHave<keyof Tags>);
            this.dispatchEvent(new CustomEvent('haveRemoved', { detail: assertion }));
            return;
        }
        throw new Error('Invalid assertion!');
    }

    /**
     * Given a have, return the needs that it satisfies
     */
    whoWants(have: IHave<keyof Tags>): INeed<keyof Tags>[] {
        const { id, source, ...templateWant } = {
            ...have,
            kind: 'need',
        };
        console.log('templateWant: ', templateWant);
        return Array.from(this.need).filter(_.matches(templateWant));
    }

    /**
     * Given a need, return the haves that satisfy it
     */
    whoHas(need: INeed<keyof Tags>): IHave<keyof Tags>[] {
        const { id, source, ...templateHave } = {
            ...need,
            kind: 'have',
        };
        console.log('templateHave: ', templateHave);
        return Array.from(this.have).filter(_.matches(templateHave));
    }
}

export const GLOBAL_POOL_ID = 'BASSLINE_GLOBAL_POOL';
export let currentPool: Pool<any> | null = new Pool(GLOBAL_POOL_ID);

let alice = 'alice';
let bob = 'bob';
let charlie = 'charlie';

let testNeed = need({ tag: 'test', source: alice });
let testNeed2 = need({ tag: 'test2', source: alice });
let testNeed3 = need({ tag: 'test', source: charlie });

let testHave = have({ tag: 'test', source: bob });
let testHave2 = have({ tag: 'test4', source: bob });

currentPool.assert(testNeed);
currentPool.assert(testNeed2);
currentPool.assert(testNeed3);
currentPool.assert(testHave);
currentPool.assert(testHave2);

let filledNeeds = currentPool.whoHas(testNeed);
console.log('filledNeeds: ', filledNeeds);
console.log('\n');

console.log('describe: ');
console.log('alice: ', currentPool.describe(alice));
console.log('\n');
console.log('bob: ', currentPool.describe(bob));
console.log('\n');
console.log('charlie: ', currentPool.describe(charlie));
console.log('\n');

console.log('testNeed: ', testNeed);
console.log('testHave: ', testHave);
console.log('matches: ', _.matches(testNeed)(testHave));