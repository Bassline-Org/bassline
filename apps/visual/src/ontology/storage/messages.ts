import { z } from 'zod'
import { guard } from '@bassline/ontology'

const EntrySchema = z.object({
  id: z.string(),
  space: z.string(),
  key: z.string(),
  msg: z.unknown(),
  prev: z.string().nullable().optional(),
})
export type Entry = z.infer<typeof EntrySchema>

const RefTargetSchema = z.union([z.object({ kind: z.enum(['entry', 'checkpoint']), id: z.string() }), z.null()])
export type RefTarget = z.infer<typeof RefTargetSchema>

const RefSchema = z.object({
  space: z.string(),
  name: z.string(),
  target: RefTargetSchema,
})
export type Ref = z.infer<typeof RefSchema>

const CheckpointSchema = z.object({
  space: z.string(),
  name: z.string(),
  tail: z.string().nullable(),
  state: z.unknown(),
})
export type Checkpoint = z.infer<typeof CheckpointSchema>

const EntryReadSelectorSchema = z.object({
  space: z.string(),
  key: z.string().optional(),
  prefix: z.string().optional(),
  after: z.string().optional(),
  limit: z.number().optional(),
})
export type EntryReadSelector = z.infer<typeof EntryReadSelectorSchema>

const EntryAppendMsgSchema = z.object({
  type: z.literal('entry-append'),
  entry: EntrySchema,
  qid: z.string().optional(),
})
const EntryStoredMsgSchema = z.object({
  type: z.literal('entry-stored'),
  entry: EntrySchema,
  qid: z.string().optional(),
})
const EntryReadMsgSchema = z.object({ type: z.literal('entry-read'), qid: z.string(), select: EntryReadSelectorSchema })
const EntryResultMsgSchema = z.object({
  type: z.literal('entry-result'),
  qid: z.string(),
  entries: z.array(EntrySchema),
})

const RefSetMsgSchema = z.object({ type: z.literal('ref-set'), ref: RefSchema, qid: z.string().optional() })
const RefStoredMsgSchema = z.object({ type: z.literal('ref-stored'), ref: RefSchema, qid: z.string().optional() })
const RefReadMsgSchema = z.object({ type: z.literal('ref-read'), qid: z.string(), space: z.string(), name: z.string() })
const RefResultMsgSchema = z.object({ type: z.literal('ref-result'), qid: z.string(), ref: RefSchema.nullable() })

const CheckpointSetMsgSchema = z.object({
  type: z.literal('checkpoint-set'),
  checkpoint: CheckpointSchema,
  qid: z.string().optional(),
})
const CheckpointStoredMsgSchema = z.object({
  type: z.literal('checkpoint-stored'),
  checkpoint: CheckpointSchema,
  qid: z.string().optional(),
})
const CheckpointReadMsgSchema = z.object({
  type: z.literal('checkpoint-read'),
  qid: z.string(),
  space: z.string(),
  name: z.string(),
})
const CheckpointResultMsgSchema = z.object({
  type: z.literal('checkpoint-result'),
  qid: z.string(),
  checkpoint: CheckpointSchema.nullable(),
})

export type EntryAppendMsg = z.infer<typeof EntryAppendMsgSchema>
export type EntryStoredMsg = z.infer<typeof EntryStoredMsgSchema>
export type EntryReadMsg = z.infer<typeof EntryReadMsgSchema>
export type EntryResultMsg = z.infer<typeof EntryResultMsgSchema>
export type RefSetMsg = z.infer<typeof RefSetMsgSchema>
export type RefStoredMsg = z.infer<typeof RefStoredMsgSchema>
export type RefReadMsg = z.infer<typeof RefReadMsgSchema>
export type RefResultMsg = z.infer<typeof RefResultMsgSchema>
export type CheckpointSetMsg = z.infer<typeof CheckpointSetMsgSchema>
export type CheckpointStoredMsg = z.infer<typeof CheckpointStoredMsgSchema>
export type CheckpointReadMsg = z.infer<typeof CheckpointReadMsgSchema>
export type CheckpointResultMsg = z.infer<typeof CheckpointResultMsgSchema>

export type StorageRequestMsg =
  | EntryAppendMsg
  | EntryReadMsg
  | RefSetMsg
  | RefReadMsg
  | CheckpointSetMsg
  | CheckpointReadMsg

export type StorageResponseMsg =
  | EntryStoredMsg
  | EntryResultMsg
  | RefStoredMsg
  | RefResultMsg
  | CheckpointStoredMsg
  | CheckpointResultMsg

export type StorageMsg = StorageRequestMsg | StorageResponseMsg

export const isEntryAppendMsg = guard(EntryAppendMsgSchema)
export const isEntryStoredMsg = guard(EntryStoredMsgSchema)
export const isEntryReadMsg = guard(EntryReadMsgSchema)
export const isEntryResultMsg = guard(EntryResultMsgSchema)
export const isRefSetMsg = guard(RefSetMsgSchema)
export const isRefStoredMsg = guard(RefStoredMsgSchema)
export const isRefReadMsg = guard(RefReadMsgSchema)
export const isRefResultMsg = guard(RefResultMsgSchema)
export const isCheckpointSetMsg = guard(CheckpointSetMsgSchema)
export const isCheckpointStoredMsg = guard(CheckpointStoredMsgSchema)
export const isCheckpointReadMsg = guard(CheckpointReadMsgSchema)
export const isCheckpointResultMsg = guard(CheckpointResultMsgSchema)
