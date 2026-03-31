export class SheetError extends Error {
  name: 'SheetError'
}

export type Coord = [row: number, col: number]
export type ValueId = string
export type CellValue = string | number
export type Region = { r: [number, number]; c: [number, number]; [meta: string]: unknown }

export type SheetEvent =
  | { type: 'set'; r: number; c: number; id: ValueId }
  | { type: 'update'; id: ValueId; value: CellValue }
  | { type: 'link'; r: number; c: number; id: ValueId }
  | { type: 'clear'; r: number; c: number }
  | { type: 'gc'; collected: Array<{ id: ValueId; value: CellValue }> }
  | { type: 'select'; name: string; region: Region | null }

export type UndoEntry = {
  op: 'set' | 'update' | 'clear' | 'link'
  r?: number
  c?: number
  id?: ValueId
  value?: CellValue
  prev?: CellValue
  prevId?: ValueId | null
}

export type CellEntry = { r: number; c: number; id: ValueId; value: CellValue | undefined }

export class Sheet {
  values: Map<ValueId, CellValue>
  cells: Map<string, ValueId>
  selections: Map<string, Region>

  on(fn: (msg: SheetEvent) => void): () => void
  /** @private */ _emit(msg: SheetEvent): void

  put(value: CellValue): ValueId
  resolve(vid: ValueId): CellValue | undefined
  update(vid: ValueId, value: CellValue): void
  gc(): Array<{ id: ValueId; value: CellValue }>

  undo(): UndoEntry | null
  redo(): UndoEntry | null

  get(coord: Coord): CellValue | undefined
  ref(coord: Coord): ValueId | undefined
  set(coord: Coord, value: CellValue): ValueId
  link(coord: Coord, vid: ValueId): void
  clear(coord: Coord): void

  select(name: string, region: Region): void
  selection(name: string): Region | undefined

  range(r0: number, c0: number, r1: number, c1: number): IterableIterator<CellEntry>
  entries(): IterableIterator<CellEntry>

  toJSON(): { values: Record<ValueId, CellValue>; cells: [number, number, ValueId][]; selections: Record<string, Region> }
  static fromJSON(json: string | { values: Record<ValueId, CellValue>; cells: [number, number, ValueId][]; selections?: Record<string, Region> }): Sheet
}

export type Rank0Handler = (coord: Coord, sheet: Sheet) => unknown
export type Rank1Handler = (row: (CellValue | undefined)[], sheet: Sheet) => unknown
export type Rank2Handler = (rows: (CellValue | undefined)[][], sheet: Sheet) => unknown

export type CommandDef =
  | { rank: 0; fn: Rank0Handler }
  | { rank: 1; fn: Rank1Handler }
  | { rank: 2; fn: Rank2Handler }

export interface Registry {
  register(name: string, def: CommandDef): void
  register(name: string, fn: Rank2Handler): void
  exec(r0: number, c0: number, r1: number, c1: number): unknown
  execAs(name: string, r0: number, c0: number, r1: number, c1: number): unknown
  execSelection(name: string): unknown
  read(r0: number, c0: number, r1: number, c1: number): (CellValue | undefined)[][]
  list(): string[]
  rankOf(name: string): 0 | 1 | 2 | undefined
}

export function createRegistry(sheet: Sheet): Registry
