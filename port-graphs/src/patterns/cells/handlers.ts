import { HandlerContext } from '../../core/context';
import type { Actions, RegistryActions } from './steps';

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
  const contradiction = actions.contradiction;
  if (contradiction) {
    console.log('contradiction!', contradiction);
    return { contradiction } as const;
  }
  return {};
}

// @goose: Handler for registry operations
export function registryHandler<T>(
  g: HandlerContext<Map<string, T>>,
  actions: RegistryActions<T>
): { registered?: { id: string }; unregistered?: string } | {} {
  if ('registered' in actions) {
    g.update(actions.registered.state);
    return { registered: { id: actions.registered.id } };
  }

  if ('unregistered' in actions) {
    g.update(actions.unregistered.state);
    return { unregistered: actions.unregistered.id };
  }

  return {};
}