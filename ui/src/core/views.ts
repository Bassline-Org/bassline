import type { ReactNode } from 'react'
import type { DescriptorSchema } from './types'

// ============================================================================
// PhlowView — Base + Subclasses
// ============================================================================

export abstract class PhlowView<T = unknown> {
  abstract readonly phlow: string
  abstract readonly title: string
  abstract readonly priority: number
  readonly target: T

  constructor(target: T) {
    this.target = target
  }

  isEmpty(): boolean {
    return false
  }
}

// --- Info ---

export type InfoEntry = () => {
  text: string
  value?: unknown
  target?: unknown
}

export type InfoConfig = {
  title: string
  priority: number
  entries: Record<string, InfoEntry>
}

export class PhlowInfoView<T = unknown> extends PhlowView<T> {
  readonly phlow = 'info' as const
  readonly title: string
  readonly priority: number
  private _entries: Record<string, InfoEntry>

  constructor(target: T, config: InfoConfig) {
    super(target)
    this.title = config.title
    this.priority = config.priority
    this._entries = config.entries
  }

  entries(): [string, InfoEntry][] {
    return Object.entries(this._entries)
  }

  entryFor(key: string): InfoEntry | undefined {
    return this._entries[key]
  }
}

// --- List ---

export type ListConfig<Item> = {
  title: string
  priority: number
  items: () => Item[]
  text: (item: Item) => string
  send?: (item: Item) => unknown
}

export class PhlowListView<T = unknown, Item = unknown> extends PhlowView<T> {
  readonly phlow = 'list' as const
  readonly title: string
  readonly priority: number
  private _items: () => Item[]
  private _text: (item: Item) => string
  private _send?: (item: Item) => unknown

  constructor(target: T, config: ListConfig<Item>) {
    super(target)
    this.title = config.title
    this.priority = config.priority
    this._items = config.items
    this._text = config.text
    this._send = config.send
  }

  items(): Item[] {
    return this._items()
  }

  textFor(item: Item): string {
    return this._text(item)
  }

  sendFor(item: Item): unknown | undefined {
    return this._send?.(item)
  }

  hasSend(): boolean {
    return this._send !== undefined
  }
}

// --- Columned List ---

export type Column<Item> = {
  text?: (item: Item) => string
  icon?: (item: Item) => string
}

export type ColumnedListConfig<Item> = {
  title: string
  priority: number
  items: () => Item[]
  columns: Record<string, Column<Item>>
  send?: (item: Item) => unknown
  sendLabel?: (item: Item) => string
}

export class PhlowColumnedListView<T = unknown, Item = unknown> extends PhlowView<T> {
  readonly phlow = 'columnedList' as const
  readonly title: string
  readonly priority: number
  private _items: () => Item[]
  readonly columns: Record<string, Column<Item>>
  private _send?: (item: Item) => unknown
  private _sendLabel?: (item: Item) => string

  constructor(target: T, config: ColumnedListConfig<Item>) {
    super(target)
    this.title = config.title
    this.priority = config.priority
    this._items = config.items
    this.columns = config.columns
    this._send = config.send
    this._sendLabel = config.sendLabel
  }

  items(): Item[] {
    return this._items()
  }

  sendFor(item: Item): unknown | undefined {
    return this._send?.(item)
  }

  sendLabelFor(item: Item): string | undefined {
    return this._sendLabel?.(item)
  }

  hasSend(): boolean {
    return this._send !== undefined
  }
}

// --- Text Editor ---

export type TextEditorConfig = {
  title: string
  priority: number
  text: () => string
  onBlur?: (text: string) => void
  onChange?: (text: string) => void
}

export class PhlowTextEditorView<T = unknown> extends PhlowView<T> {
  readonly phlow = 'textEditor' as const
  readonly title: string
  readonly priority: number
  private _text: () => string
  private _onBlur?: (text: string) => void
  private _onChange?: (text: string) => void

  constructor(target: T, config: TextEditorConfig) {
    super(target)
    this.title = config.title
    this.priority = config.priority
    this._text = config.text
    this._onBlur = config.onBlur
    this._onChange = config.onChange
  }

  text(): string {
    return this._text()
  }

  onBlur(text: string): void {
    this._onBlur?.(text)
  }

  onChange(text: string): void {
    this._onChange?.(text)
  }
}

// --- Explicit ---

export type ExplicitConfig = {
  title: string
  priority: number
  component: () => ReactNode
}

export class PhlowExplicitView<T = unknown> extends PhlowView<T> {
  readonly phlow = 'explicit' as const
  readonly title: string
  readonly priority: number
  readonly component: () => ReactNode

  constructor(target: T, config: ExplicitConfig) {
    super(target)
    this.title = config.title
    this.priority = config.priority
    this.component = config.component
  }
}

// --- Descriptor ---

export type DescriptorConfig<Model> = {
  title: string
  priority: number
  schema: () => DescriptorSchema
  model: () => Model
  onUpdate?: (model: Model) => void
}

export class PhlowDescriptorView<T = unknown, Model = unknown> extends PhlowView<T> {
  readonly phlow = 'descriptor' as const
  readonly title: string
  readonly priority: number
  private _schema: () => DescriptorSchema
  private _model: () => Model
  private _onUpdate?: (model: Model) => void

  constructor(target: T, config: DescriptorConfig<Model>) {
    super(target)
    this.title = config.title
    this.priority = config.priority
    this._schema = config.schema
    this._model = config.model
    this._onUpdate = config.onUpdate
  }

  schema(): DescriptorSchema {
    return this._schema()
  }

  model(): Model {
    return this._model()
  }

  onUpdate(model: Model): void {
    this._onUpdate?.(model)
  }
}

// --- Forward ---

export type ForwardConfig = {
  title: string
  priority: number
  view: () => PhlowView
}

export class PhlowForwardView<T = unknown> extends PhlowView<T> {
  readonly phlow = 'forward' as const
  readonly title: string
  readonly priority: number
  private _view: () => PhlowView

  constructor(target: T, config: ForwardConfig) {
    super(target)
    this.title = config.title
    this.priority = config.priority
    this._view = config.view
  }

  view(): PhlowView {
    return this._view()
  }
}

// --- Panel ---

export type PanelConfig = {
  title: string
  priority?: number
  component: (onInspect: (target: unknown, label?: string) => void) => ReactNode
}

export class PhlowPanelView<T = unknown> extends PhlowView<T> {
  readonly phlow = 'panel' as const
  readonly title: string
  readonly priority: number
  readonly component: (onInspect: (target: unknown, label?: string) => void) => ReactNode

  constructor(target: T, config: PanelConfig & { priority: number }) {
    super(target)
    this.title = config.title
    this.priority = config.priority
    this.component = config.component
  }
}

// ============================================================================
// PhlowSearchSource
// ============================================================================

export type SearchSourceConfig<Item> = {
  title: string
  priority?: number
  items: (query: string) => Item[]
  text: (item: Item) => string
  send?: (item: Item) => unknown
  /** When true, call items('') on empty query instead of returning []. */
  showOnEmpty?: boolean
}

export class PhlowSearchSource<T = unknown, Item = unknown> {
  readonly title: string
  readonly priority: number
  readonly target: T
  readonly showOnEmpty: boolean
  private _items: (query: string) => Item[]
  private _text: (item: Item) => string
  private _send?: (item: Item) => unknown

  constructor(target: T, config: SearchSourceConfig<Item> & { priority: number }) {
    this.target = target
    this.title = config.title
    this.priority = config.priority
    this.showOnEmpty = config.showOnEmpty ?? false
    this._items = config.items
    this._text = config.text
    this._send = config.send
  }

  items(query: string): Item[] {
    if (!query && !this.showOnEmpty) return []
    return this._items(query)
  }

  textFor(item: Item): string {
    return this._text(item)
  }

  sendFor(item: Item): unknown | undefined {
    return this._send?.(item)
  }

  hasSend(): boolean {
    return this._send !== undefined
  }

  isEmpty(): boolean {
    return false
  }
}

// ============================================================================
// PhlowAction — Base + Subclasses
// ============================================================================

export abstract class PhlowAction<T = unknown> {
  abstract readonly phlow: string
  readonly target: T
  readonly priority: number

  constructor(target: T, priority: number = 50) {
    this.target = target
    this.priority = priority
  }

  isEmpty(): boolean {
    return false
  }
}

export class PhlowEmptyAction<T = unknown> extends PhlowAction<T> {
  readonly phlow = 'emptyAction' as const

  constructor(target: T) {
    super(target, 0)
  }

  isEmpty(): boolean {
    return true
  }
}

export type ButtonActionConfig = {
  label: string
  icon?: ReactNode
  tooltip?: string
  priority?: number
  enabled?: () => boolean
  onClick: () => void | unknown | Promise<unknown>
}

export class PhlowButtonAction<T = unknown> extends PhlowAction<T> {
  readonly phlow = 'buttonAction' as const
  readonly label: string
  readonly icon?: ReactNode
  readonly tooltip?: string
  private _enabled?: () => boolean
  private _onClick: () => void | unknown | Promise<unknown>

  constructor(target: T, config: ButtonActionConfig) {
    super(target, config.priority ?? 50)
    this.label = config.label
    this.icon = config.icon
    this.tooltip = config.tooltip
    this._enabled = config.enabled
    this._onClick = config.onClick
  }

  isEnabled(): boolean {
    return this._enabled?.() ?? true
  }

  onClick(): void | unknown | Promise<unknown> {
    return this._onClick()
  }
}
