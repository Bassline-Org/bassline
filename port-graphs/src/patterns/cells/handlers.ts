import _ from 'lodash';
import { Arrow, Gadget, Handler, protoGadget, memoryStore, quick, Store, HandlerContext, ProtoGadget, CellActions } from '../../core/context';
import { maxStep } from './steps';

// ================================================
// Cell Handlers
// ================================================

// @goose: Handler for merging values
type Merge<T> = {
  changed?: T;
}

export const mergeHandler = <S>(g: HandlerContext<S>, actions: CellActions<S>): Merge<S> => {
  if ('merge' in actions && actions.merge !== undefined) {
    g.update(actions.merge);
    return { changed: actions.merge } as const;
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

type Contradicts<S> = {
  contradiction?: S;
};

// @goose: Handler for contradiction
export const contradictionHandler = <S>(g: HandlerContext<S>, actions: Contradicts<S>) => {
  const contradiction = _.get(actions, 'contradiction');
  if (contradiction) {
    console.log('contradiction!', contradiction);
    return { oops: contradiction } as const;
  }
  return {} as const;
};

// @goose: Compose multiple handlers into a single handler
export const composeHandlers = <S, A, E>(
  ...handlers: Handler<S, A, E>[]
): Handler<S, A, E> => (g, actions) => {
  return handlers.map(h => h(g, actions)).filter(h => h !== undefined).reduce((acc, h) => {
    return { ...acc, ...h };
  }, {} as E);
};

const p = protoGadget((a: number, b: number) => {
  if (a > b) {
    return { merge: a } as const;
  }
  if (a < b) {
    return { merge: b } as const;
  }
  return { contradiction: a } as const;
})
  .handler(composeHandlers(mergeHandler, contradictionHandler));

const g = quick(p, 0, exampleEmit);