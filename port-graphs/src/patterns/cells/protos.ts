import { protoGadget } from '../../core/context';
import {
  maxStep,
  minStep,
  lastStep,
  firstStep,
  ordinalStep,
  unionStep,
  intersectionStep,
  counterStep
} from './steps';
import { mergeHandler, contradictionHandler, composeHandlers } from './handlers';

// ================================================
// Proto-Gadgets (Pre-composed Step + Handler)
// ================================================

// Numeric protos
export const maxProto = protoGadget(maxStep).handler(mergeHandler());
export const minProto = protoGadget(minStep).handler(mergeHandler());

// Generic protos
export const lastProto = <T>() =>
  protoGadget(lastStep<T>()).handler(mergeHandler());

export const firstProto = <T>() =>
  protoGadget(firstStep<T>()).handler(mergeHandler());

export const ordinalProto = <T>() =>
  protoGadget(ordinalStep<T>()).handler(mergeHandler());

// Set protos
export const unionProto = <T>() =>
  protoGadget(unionStep<T>()).handler(mergeHandler());

export const intersectionProto = <T>() =>
  protoGadget(intersectionStep<T>()).handler(
    composeHandlers(mergeHandler(), contradictionHandler())
  );

// Counter proto factory
export const counterProto = (initial: number, min: number, max: number) =>
  protoGadget(counterStep(initial, min, max)).handler(mergeHandler());