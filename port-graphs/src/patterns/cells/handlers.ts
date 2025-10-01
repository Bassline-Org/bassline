import _ from 'lodash';
import { Arrow, Gadget, Handler, CellEffects, protoGadget, memoryStore, quick, Store, HandlerContext, ProtoGadget } from '../../core/context';
import { maxStep } from './steps';

// ================================================
// Cell Handlers
// ================================================

// @goose: Handler for merging values
type Merge<T> = {
  changed?: T;
}

export const mergeHandler = <S>(g: HandlerContext<S>, effects: CellEffects<S>): Merge<S> => {
  if ('merge' in effects && effects.merge !== undefined) {
    g.update(effects.merge);
    return { changed: effects.merge } as const;
  }
  return {} as const;
};

const exampleEmit = <E>(effects: E) => {
  console.log('exampleEmit', effects);
};

const proto = protoGadget(maxStep)
  .handler(mergeHandler);

const gadget = quick(proto, 0, exampleEmit);
type Foo = typeof gadget.emit

// // @goose: Handler for contradiction
// export const contradictionHandler = <S, I, A extends CellEffects<S>, E>(g: Gadget<S, I, A, E>, effects: A) => {
//   const contradiction = _.get(effects, 'contradiction');
//   if (contradiction) {
//     console.log('contradiction!', contradiction);
//   }
//   return {} as E;
// };

// // @goose: Compose multiple handlers into a single handler
// export const composeHandlers = <S, I, A extends CellEffects<S>, E>(
//   ...handlers: Handler<A, E>[]
// ): Handler<Step> => (g, effects) => {
//   handlers.forEach(h => h(g, effects));
// };