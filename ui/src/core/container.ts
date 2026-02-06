import { phlowViews, phlowActions, phlowSearches, PRIORITY, shouldInheritViews } from './phlow'
import {
  PhlowView,
  PhlowInfoView,
  PhlowListView,
  PhlowColumnedListView,
  PhlowTextEditorView,
  PhlowExplicitView,
  PhlowDescriptorView,
  PhlowForwardView,
  PhlowPanelView,
  PhlowAction,
  PhlowButtonAction,
  PhlowSearchSource,
  type InfoConfig,
  type ListConfig,
  type ColumnedListConfig,
  type TextEditorConfig,
  type ExplicitConfig,
  type DescriptorConfig,
  type ForwardConfig,
  type PanelConfig,
  type ButtonActionConfig,
  type SearchSourceConfig,
} from './views'

type PartialPriority<C> = Omit<C, 'priority'> & { priority?: number }

// ============================================================================
// ViewContainer
// ============================================================================

export type ViewFactory<T> = (self: T) => PhlowView<T>

export class ViewContainer<T = unknown> {
  private _factories: ViewFactory<T>[] = []

  info(configFn: (self: T) => PartialPriority<InfoConfig>): this {
    this._factories.push(self => {
      const config = configFn(self)
      return new PhlowInfoView(self, { priority: PRIORITY.low, ...config })
    })
    return this
  }

  list<Item>(configFn: (self: T) => PartialPriority<ListConfig<Item>>): this {
    this._factories.push(self => {
      const config = configFn(self)
      return new PhlowListView<T, Item>(self, { priority: PRIORITY.low, ...config })
    })
    return this
  }

  columnedList<Item>(configFn: (self: T) => PartialPriority<ColumnedListConfig<Item>>): this {
    this._factories.push(self => {
      const config = configFn(self)
      return new PhlowColumnedListView<T, Item>(self, { priority: PRIORITY.low, ...config })
    })
    return this
  }

  textEditor(configFn: (self: T) => PartialPriority<TextEditorConfig>): this {
    this._factories.push(self => {
      const config = configFn(self)
      return new PhlowTextEditorView(self, { priority: PRIORITY.low, ...config })
    })
    return this
  }

  explicit(configFn: (self: T) => PartialPriority<ExplicitConfig>): this {
    this._factories.push(self => {
      const config = configFn(self)
      return new PhlowExplicitView(self, { priority: PRIORITY.low, ...config })
    })
    return this
  }

  descriptor<Model>(configFn: (self: T) => PartialPriority<DescriptorConfig<Model>>): this {
    this._factories.push(self => {
      const config = configFn(self)
      return new PhlowDescriptorView<T, Model>(self, { priority: PRIORITY.low, ...config })
    })
    return this
  }

  forward(configFn: (self: T) => PartialPriority<ForwardConfig>): this {
    this._factories.push(self => {
      const config = configFn(self)
      return new PhlowForwardView(self, { priority: PRIORITY.low, ...config })
    })
    return this
  }

  panel(configFn: (self: T) => PanelConfig): this {
    this._factories.push(self => {
      const config = configFn(self)
      return new PhlowPanelView(self, { priority: PRIORITY.low, ...config })
    })
    return this
  }

  add(factory: ViewFactory<T>): this {
    this._factories.push(factory)
    return this
  }

  get factories(): ReadonlyArray<ViewFactory<T>> {
    return this._factories
  }

  /**
   * Collect all view factories from a target's prototype chain,
   * call each with the target, filter empties, and sort by priority.
   */
  static collect<T>(target: object): PhlowView<T>[] {
    const all: ViewFactory<T>[] = []
    let current: object | null = target

    while (current !== null) {
      if (current !== target && !shouldInheritViews(current)) {
        break
      }

      if (Object.prototype.hasOwnProperty.call(current, phlowViews)) {
        const container = (current as any)[phlowViews]
        if (container && typeof container === 'object' && Array.isArray(container.factories)) {
          all.push(...container.factories)
        }
      }

      current = Object.getPrototypeOf(current)
    }

    return all
      .map(f => f(target as unknown as T))
      .filter(v => !v.isEmpty())
      .sort((a, b) => a.priority - b.priority)
  }
}

// ============================================================================
// ActionContainer
// ============================================================================

export type ActionFactory<T> = (self: T) => PhlowAction<T>

export class ActionContainer<T = unknown> {
  private _factories: ActionFactory<T>[] = []

  button(configFn: (self: T) => ButtonActionConfig): this {
    this._factories.push(self => {
      const config = configFn(self)
      return new PhlowButtonAction(self, config)
    })
    return this
  }

  add(factory: ActionFactory<T>): this {
    this._factories.push(factory)
    return this
  }

  get factories(): ReadonlyArray<ActionFactory<T>> {
    return this._factories
  }

  /**
   * Collect all action factories from a target (no prototype chain walking).
   */
  static collect(target: object): PhlowButtonAction[] {
    const container = (target as any)[phlowActions]
    if (!container || typeof container !== 'object' || !Array.isArray(container.factories)) {
      return []
    }

    return container.factories
      .map((f: ActionFactory<unknown>) => f(target))
      .filter((a: PhlowAction<unknown>) => !a.isEmpty())
      .sort((a: PhlowAction<unknown>, b: PhlowAction<unknown>) => a.priority - b.priority) as PhlowButtonAction[]
  }
}

// ============================================================================
// SearchContainer
// ============================================================================

export type SearchFactory<T> = (self: T) => PhlowSearchSource<T>

export class SearchContainer<T = unknown> {
  private _factories: SearchFactory<T>[] = []

  source<Item>(configFn: (self: T) => SearchSourceConfig<Item>): this {
    this._factories.push(self => {
      const config = configFn(self)
      return new PhlowSearchSource<T, Item>(self, {
        priority: PRIORITY.low,
        ...config,
      }) as unknown as PhlowSearchSource<T>
    })
    return this
  }

  add(factory: SearchFactory<T>): this {
    this._factories.push(factory)
    return this
  }

  get factories(): ReadonlyArray<SearchFactory<T>> {
    return this._factories
  }

  /**
   * Collect all search sources from a target (no prototype chain walking).
   */
  static collect(target: object): PhlowSearchSource[] {
    const container = (target as any)[phlowSearches]
    if (!container || typeof container !== 'object' || !Array.isArray(container.factories)) {
      return []
    }

    return container.factories
      .map((f: SearchFactory<unknown>) => f(target))
      .filter((s: PhlowSearchSource) => !s.isEmpty())
      .sort((a: PhlowSearchSource, b: PhlowSearchSource) => a.priority - b.priority)
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function views<T>(): ViewContainer<T> {
  return new ViewContainer<T>()
}

export function actions<T>(): ActionContainer<T> {
  return new ActionContainer<T>()
}

export function searches<T>(): SearchContainer<T> {
  return new SearchContainer<T>()
}
