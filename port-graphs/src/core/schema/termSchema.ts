import * as z from 'zod';

// =======================
// Atomic Terms
// =======================

// Strings are any string that doesn't start with :
export const StringTermSchema = z.string().nonempty()
    .refine(str => !str.startsWith(':'))
    .refine(str => str !== '*nothing*');
export type StringTerm = z.infer<typeof StringTermSchema>

// Symbols are any string that starts with :
// :foo
export const SymbolTermSchema = z.string()
    .refine(str => str.startsWith(':') && str.length > 1)
    .refine(str => str !== '*nothing*');

export type SymbolTerm = z.infer<typeof SymbolTermSchema>

export const NumberTermSchema = z.number()
export type NumberTerm = z.infer<typeof NumberTermSchema>

export const BooleanTermSchema = z.boolean()
export type BooleanTerm = z.infer<typeof BooleanTermSchema>

export const AtomicTermSchema = z.union([
    StringTermSchema,
    SymbolTermSchema,
    NumberTermSchema,
    BooleanTermSchema,
])
export type AtomicTerm = z.infer<typeof AtomicTermSchema>

// =======================
// Special Terms
// =======================

// Represents an error from a cell merge function
export const ContradictionTermSchema = z.object({
    type: z.literal('contradiction'),
    get currentValue() {
        return TermSchema
    },
    get incomingValue() {
        return TermSchema
    },
    gadgetId: StringTermSchema,
    networkId: StringTermSchema,
    reason: StringTermSchema
});
export type ContradictionTerm = z.infer<typeof ContradictionTermSchema>

// Represent no information or unknown value
export const NothingTermSchema = z.literal("*nothing*")
export type NothingTerm = z.infer<typeof NothingTermSchema>

// Represent opaque data from the host language
export const OpaqueTermSchema = z.object({
    type: z.literal('opaque'),
    value: z.any()
})
export type OpaqueTerm = z.infer<typeof OpaqueTermSchema>

export const SpecialTermSchema = z.union([OpaqueTermSchema, ContradictionTermSchema, NothingTermSchema]);
export type SpecialTerm = z.infer<typeof SpecialTermSchema>

// Finally define the main TermSchema that references all the others
export const TermSchema = z.union([AtomicTermSchema, SpecialTermSchema])
export type Term = z.infer<typeof TermSchema>

export const TermListSchema = TermSchema.array()
export type TermList = z.infer<typeof TermListSchema>

export const StringTermDictSchema = z.record(StringTermSchema, TermSchema)
export type StringTermDict = z.infer<typeof StringTermDictSchema>
export const SymbolTermDictSchema = z.record(SymbolTermSchema, TermSchema)
export type SymbolTermDict = z.infer<typeof SymbolTermDictSchema>
export const TermDictSchema = z.union([StringTermDictSchema, SymbolTermDictSchema])
export type TermDict = z.infer<typeof TermDictSchema>