import type { GadgetTemplate } from '../types/template'
import { ContactGroup } from '../models/ContactGroup'
import { createPrimitiveGadget } from '../primitives-registry'

/**
 * Factory for creating gadgets from templates, handling both primitive and regular gadgets
 */
export class GadgetFactory {
  static fromTemplate(template: GadgetTemplate, parent?: ContactGroup): ContactGroup {
    // Check if this is a primitive gadget
    if (template.isPrimitive && template.primitiveType) {
      const primitive = createPrimitiveGadget(template.primitiveType, parent)
      if (primitive) {
        return primitive
      }
      console.warn(`Failed to create primitive gadget: ${template.primitiveType}`)
      // Fall through to create a regular ContactGroup as fallback
    }
    
    // Create a regular ContactGroup - but use this factory for subgroups too
    return ContactGroup.fromTemplateWithFactory(template, parent, GadgetFactory.fromTemplate)
  }
}