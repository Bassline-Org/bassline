import * as z from "zod"
import { GadgetSchema, InputPortSchema, OutputPortSchema } from "./graphSchema"
import { TermSchema } from "./termSchema"

export const FunctionGadgetSchema = GadgetSchema.and(z.object({
    type: z.literal('function'),
    function: z.function(),
}))
export type FunctionGadget = z.infer<typeof FunctionGadgetSchema>

export const CellMergeFunctionSchema = z.function({
    input: z.tuple([TermSchema, TermSchema]),
    output: TermSchema,
})
export type CellMergeFunction = z.infer<typeof CellMergeFunctionSchema>

export const CellGadgetSchema = GadgetSchema.and(z.object({
    type: z.literal('cell'),
    merge: CellMergeFunctionSchema,
    inputs: z.object({
        'value-in': InputPortSchema,
    }).strict(),
    outputs: z.object({
        'value-out': OutputPortSchema,
    }).strict(),
}))
export type CellGadget = z.infer<typeof CellGadgetSchema>