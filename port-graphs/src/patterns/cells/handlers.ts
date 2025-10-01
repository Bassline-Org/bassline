import _ from 'lodash';
import { HandlerContext } from '../../core/context';

// ================================================
// Cell Handlers
// ================================================

export function mergeHandler<S>(
  g: HandlerContext<S>,
  actions: { merge?: S }
): Partial<{ changed: S }> {
  if ('merge' in actions && actions.merge !== undefined) {
    g.update(actions.merge);
    return { changed: actions.merge };
  }
  return {};
}

// @goose: Handler for contradiction
export function contradictionHandler<S>(
  _g: HandlerContext<S>,
  actions: { contradiction?: S }
): { oops?: S } {
  const contradiction = _.get(actions, 'contradiction');
  if (contradiction) {
    console.log('contradiction!', contradiction);
    return { oops: contradiction };
  }
  return {};
}