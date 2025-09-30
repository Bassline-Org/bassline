import { protoGadget } from '../../core/context';
import { fnStep, type FnRecord } from './steps';
import { fnHandler } from './handlers';

// ================================================
// Function Proto Factory
// ================================================

type FnArgs<T> = T extends (args: infer Args) => unknown
  ? Args extends Record<string, unknown> ? Args : never
  : never;

export const fnProto = <Compute extends (args: unknown) => unknown>(
  compute: Compute,
  requiredKeys: (keyof FnArgs<Compute>)[]
) => protoGadget(fnStep(compute, requiredKeys)).handler(fnHandler());