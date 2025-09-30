import { protoGadget } from '../../core/context';
import { lastTableStep, firstTableStep, unionTableStep, familyTableStep } from './steps';
import { tableHandler, familyHandler } from './handlers';

// ================================================
// Table Proto-Gadgets
// ================================================

export const lastTableProto = <K extends PropertyKey, V>() =>
  protoGadget(lastTableStep<K, V>()).handler(tableHandler());

export const firstTableProto = <K extends PropertyKey, V>() =>
  protoGadget(firstTableStep<K, V>()).handler(tableHandler());

export const unionTableProto = <K extends PropertyKey, V>() =>
  protoGadget(unionTableStep<K, V>()).handler(tableHandler());

export const familyTableProto = <K extends PropertyKey, G>(factory: () => G) =>
  protoGadget(familyTableStep<K, G>(factory)).handler(familyHandler());