/**
 * Schema type for descriptor views (optional Zod integration)
 */
export type DescriptorSchema = {
  parse: (data: unknown) => unknown
  safeParse: (data: unknown) => { success: boolean; data?: unknown; error?: unknown }
}
