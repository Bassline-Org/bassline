import * as z from "zod"
import { StringTermDictSchema, StringTermSchema, TermSchema } from "./termSchema"

export const GraphElementSchema = StringTermDictSchema.and(z.object({
    id: StringTermSchema,
    networkId: StringTermSchema,
    attributes: StringTermDictSchema.optional(),
}))
export type GraphElement = z.infer<typeof GraphElementSchema>

export const ConnectionSchema = GraphElementSchema.and(z.object({
    source: {
        gadgetId: StringTermSchema,
        portName: StringTermSchema,
    },
    target: {
        gadgetId: StringTermSchema,
        portName: StringTermSchema,
    },
}));
export type Connection = z.infer<typeof ConnectionSchema>

export const InputPortSchema = GraphElementSchema.and(z.object({
    id: StringTermSchema,
    gadgetId: StringTermSchema,
    value: TermSchema,
    direction: z.literal('input'),
}))
export type InputPort = z.infer<typeof InputPortSchema>

export const OutputPortSchema = GraphElementSchema.and(z.object({
    id: StringTermSchema,
    gadgetId: StringTermSchema,
    value: TermSchema,
    direction: z.literal('output'),
}))
export type OutputPort = z.infer<typeof OutputPortSchema>

export const GadgetSchema = GraphElementSchema.and(z.object({
    type: StringTermSchema,
    inputs: z.record(StringTermSchema, InputPortSchema),
    outputs: z.record(StringTermSchema, OutputPortSchema),
})).refine((gadget) => {
    Object.keys(gadget.inputs).length > 0
}, {
    message: 'Gadget must have at least one input',
}).refine((gadget) => {
    return Object.keys(gadget.outputs).length > 0;
}, {
    message: 'Gadget must have at least one output',
})
export type Gadget = z.infer<typeof GadgetSchema>

export const NetworkSchema = z.object({
    id: StringTermSchema,
    gadgets: z.record(StringTermSchema, GadgetSchema),
    connections: z.record(StringTermSchema, z.record(StringTermSchema, z.array(ConnectionSchema))),
})
export type Network = z.infer<typeof NetworkSchema>