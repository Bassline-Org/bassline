export interface ProtocolDefinition {
  extends?: string[];
  get?: string[];
  put?: string[];
}

export interface ResolvedProtocol {
  get: string[];
  put: string[];
}

export interface SpecData {
  name: string;
  version: string;
  protocols?: Record<string, ProtocolDefinition>;
}

export interface SpecResource {
  (): SpecData;
  (msg: { protocol: string }): ResolvedProtocol | undefined;
  (msg: { protocols: true }): Record<string, ProtocolDefinition>;
  (msg: { version: true }): string;
  (msg: { name: true }): string;
  readonly [Symbol.for('$$_RESOURCE_$$')]: true;
  options: Record<string, any>;
}

export type ConformsResult =
  | { ok: true; selector: string; dispatch: 'get' | 'put' }
  | { ok: false; error: string };

export declare const coreSpec: SpecData;
export declare function spec(data: SpecData): SpecResource;
export declare function selector(msg: Record<string, any>): string;
export declare function conforms(
  message: Record<string, any>,
  protocolName: string,
  specResource: SpecResource
): ConformsResult;
