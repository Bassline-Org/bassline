declare const RESOURCE: unique symbol;

export declare namespace Protocols {
    interface Resource<
        GetMsg extends Record<string, any> = Record<string, any>,
        PutBody = any,
        GetReturn = any,
        PutReturn = any
    > {
        (msg: { put: PutBody } & Omit<GetMsg, 'put'>): PutReturn;
        (msg?: GetMsg): GetReturn;
        readonly [RESOURCE]: true;
        options: Record<string, any>;
    }

    type AnyResource = Resource;

    interface Slot<T> {
        (): T;
        (msg: { put: T }): T;
        readonly [RESOURCE]: true;
        options: Record<string, any>;
    }

    interface Slots<T> {
        (msg: { at: string }): T;
        (msg: { at: string; ifAbsentPut: T }): T;
        (msg: { at: string; put: T }): T;
        (msg: { at: string; put: null }): boolean;
        readonly [RESOURCE]: true;
        options: Record<string, any>;
    }
}

interface ResourceOptions<
    GetMsg extends Record<string, any> = Record<string, any>,
    PutBody = any,
    GetReturn = any,
    PutReturn = any
> {
    get?(msg: GetMsg): GetReturn;
    put?(body: PutBody, msg: Omit<GetMsg, 'put'>): PutReturn;
    dnu?(msg: any): any;
    [key: string]: unknown;
}

export function resource<
    GetMsg extends Record<string, any> = Record<string, any>,
    PutBody = any,
    GetReturn = any,
    PutReturn = any
>(options?: ResourceOptions<GetMsg, PutBody, GetReturn, PutReturn>
    & ThisType<Record<string, any>>
): Protocols.Resource<GetMsg, PutBody, GetReturn, PutReturn>;
interface AdaptOptions {
    input?(msg: any): any;
    output?(result: any): any;
    get?(msg: any): any;
    put?(body: any, msg: any): any;
    dnu?(msg: any): any;
    [key: string]: unknown;
}

export function adapt(
    target: Protocols.AnyResource,
    options?: AdaptOptions & ThisType<{ target: Protocols.AnyResource } & Record<string, any>>
): Protocols.AnyResource;

export function pipe<A, B>(f1: (a: A) => B): (a: A) => B;
export function pipe<A, B, C>(f1: (a: A) => B, f2: (b: B) => C): (a: A) => C;
export function pipe<A, B, C, D>(f1: (a: A) => B, f2: (b: B) => C, f3: (c: C) => D): (a: A) => D;
export function pipe(...fns: Array<(x: any) => any>): (x: any) => any;

export function watchable(target: Protocols.AnyResource): Protocols.AnyResource;

export function slot<T>(value?: T): Protocols.Slot<T>;
export function slots<T = any>(): Protocols.Slots<T>;
export function isResource(v: unknown): v is Protocols.AnyResource;
export { RESOURCE };
