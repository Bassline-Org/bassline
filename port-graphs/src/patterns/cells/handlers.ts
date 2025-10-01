import _ from 'lodash';
import { HandlerContext } from '../../core/context';
import type { Actions } from './steps';

// ================================================
// Cell Handlers
// ================================================
export function mergeHandler<S>(
  g: HandlerContext<S>,
  actions: Actions<S>
): { changed: S } | {} {
  if (actions && 'merge' in actions && actions.merge !== undefined) {
    g.update(actions.merge);
    return { changed: actions.merge } as const;
  }
  return {};
}

// @goose: Handler for contradiction
export function contradictionHandler<S>(
  _g: HandlerContext<S>,
  actions: Actions<S>
): { contradiction: { current: S, incoming: S } } | {} {
  const contradiction = _.get(actions, 'contradiction');
  if (contradiction) {
    console.log('contradiction!', contradiction);
    return { contradiction } as const;
  }
  return {};
}