import { protoGadget } from '../../core/context';
import {
  maxStep,
  minStep,
  lastStep,
  firstStep,
  ordinalStep,
  unionStep,
  intersectionStep,
  registryStep,
} from './steps';
import { mergeHandler, contradictionHandler, registryHandler } from './handlers';

// ================================================
// Proto-Gadgets (Pre-composed Step + Handler)
// ================================================

// Numeric protos
export const maxProto = protoGadget(maxStep).handler(mergeHandler);
export const minProto = protoGadget(minStep).handler(mergeHandler);

// Generic protos
export const lastProto = <T>() =>
  protoGadget(lastStep<T>()).handler(mergeHandler);

export const firstProto = <T>() =>
  protoGadget(firstStep<T>()).handler(mergeHandler);

export const ordinalProto = <T>() =>
  protoGadget(ordinalStep<T>()).handler(mergeHandler);

// Set protos
export const unionProto = <T>() =>
  protoGadget(unionStep<T>()).handler(mergeHandler);

export const intersectionProto = <T>() =>
  protoGadget(intersectionStep<T>()).handler((g, actions) => ({
    ...mergeHandler(g, actions),
    ...contradictionHandler(g, actions)
  }));

// Registry proto
export const registryProto = <T>() =>
  protoGadget(registryStep<T>()).handler(registryHandler);