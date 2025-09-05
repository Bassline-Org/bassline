import _ from "lodash";
import { Pool, INeed, IHave, IAssertion, need, have } from "./pool";

export abstract class BaseGadget extends EventTarget {
    public readonly id: string;
    pool?: Pool;
    running: boolean = false;
    has: Set<IHave<any>> = new Set();
    needs: Set<INeed<any>> = new Set();

    constructor() {
        super();
        this.id = _.uniqueId();
    }
    // noop by default
    setup(): void {}
    onStart(): void {}

    announce<T>(kind: string, data: T): void {
        this.dispatchEvent(new CustomEvent<T>(kind, { detail: data }));
    }

    need(tag: string | number | symbol): void {
        if(!this.pool) {
            console.error('Gadget not started, cannot assert');
            return;
        }
        this.pool.assert(need({ tag, source: this.id }));
        this.needs.add(need({ tag, source: this.id }));
    }

    have(tag: string | number | symbol): void {
        if(!this.pool) {
            console.error('Gadget not started, cannot assert');
            return;
        }
        const assertion = have({ tag, source: this.id });
        this.pool.assert(assertion);
        this.has.add(assertion);
    }

    start(pool: Pool<any>): this {
        if (this.running) return this;
        this.setup();
        this.running = true;

        this.pool = pool;

        this.receive({ type: 'pool:bind', pool });

        return this;
    }

    receive(data: unknown): void {
        let result;
        try {
            result = this.apply(data)
        } catch(e) {
            result = e
        }
        const consideration = this.consider(result);
        if (consideration != null) {
            this.act(consideration);
        }
    }

    abstract apply(data: unknown): unknown;
    
    consider(result: unknown): unknown | null {
        return result;  // Default: pass through
    }
    
    act(consideration: unknown): void {
        // default noop
    }
}

export type CellMergeFn<T> = (old: T, incoming: T) => T;
export abstract class Cell<T = unknown> extends BaseGadget {
    merge: CellMergeFn<T>;
    current: T;

    constructor(merge: CellMergeFn<T>, initial: T) {
        super();
        this.merge = merge;
        this.current = initial;
    }

    apply(incoming: T): T {
        const oldValue = this.current;
        return this.merge(oldValue, incoming);
    }

    consider(result: T): T | null {
        if(_.isEqual(result, this.current)) {
            return null
        }
        this.current = result;
        return result;
    }

    act(value: T): void {
        this.announce('propagate', value);
    }
}