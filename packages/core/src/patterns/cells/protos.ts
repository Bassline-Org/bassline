import { Implements, protoGadget, quick, withTaps } from '../../core';
import {
  maxStep,
  minStep,
  lastStep,
  firstStep,
  ordinalStep,
  unionStep,
  intersectionStep,
  registryStep,
  firstTableStep,
  lastTableStep,
} from './steps';
import { mergeHandler, contradictionHandler, registryHandler, tableHandler } from './handlers';
import { Valued } from '../../core';

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

// Table proto
export const firstTableProto = <K extends string, V>() =>
  protoGadget(firstTableStep<K, V>).handler((g, actions) => ({
    ...mergeHandler(g, actions),
    ...tableHandler(g, actions),
  }));

export const lastTableProto = <K extends string, V>() =>
  protoGadget(lastTableStep<K, V>).handler((g, actions) => ({
    ...mergeHandler(g, actions),
    ...tableHandler(g, actions),
  }));