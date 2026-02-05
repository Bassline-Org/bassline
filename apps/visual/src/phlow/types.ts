import z from 'zod'

export type Config<View, Omitted extends keyof any = 'phlow'> = Partial<Omit<View, Omitted>>
export type View<T = unknown> = Empty | NonEmptyView<T>
export type NonEmptyView<T> = Forward<T> | List<T> | ColumnedList<T> | TextEditor | Explicit | Descriptor<T> | Info
export type Base = {
  title: string
  priority: number
}
export type Empty = { phlow: 'empty' }
export type Forward<T> = Base & {
  phlow: 'forward'
  view: () => View<T>
}
export type List<T = unknown> = Base & {
  phlow: 'list'
  items(): T[]
  text(item: T): string
}
export type Info = Base & {
  phlow: 'info'
  entries: {
    [key in string]: () => { text: string; target?: unknown }
  }
}
export type ColumnedList<T = unknown> = Base & {
  phlow: 'columnedList'
  items(): T[]
  columns: Record<string, Column<T>>
}
export type Column<T> = {
  text?: (item: T) => string
  icon?: (item: T) => string
}
export type TextEditor = Base & {
  phlow: 'textEditor'
  text: () => string
  onBlur?: (text: string) => void
  onChange?: (text: string) => void
}
export type Explicit = Base & {
  phlow: 'explicit'
  component: () => React.ReactNode
}
export type Descriptor<T = unknown> = Base & {
  phlow: 'descriptor'
  schema: () => z.ZodObject<z.ZodRawShape>
  model: () => T
  onUpdate?: (model: T) => void
}
