import type { Contact } from '../models/Contact'
import type { ConnectionValidationResult } from './types'

export class ConnectionValidator {
  canConnect(from: Contact, to: Contact): boolean {
    // Same group - always OK
    if (from.group === to.group) {
      return true
    }
    
    // Parent to child boundary - OK
    if (to.isBoundary && to.group.parent === from.group) {
      return true
    }
    if (from.isBoundary && from.group.parent === to.group) {
      return true
    }
    
    // Child boundary to child boundary (same parent) - OK
    if (from.isBoundary && to.isBoundary && 
        from.group.parent === to.group.parent) {
      return true
    }
    
    return false
  }
  
  validateConnection(fromId: string, toId: string, context: { findContact: (id: string) => Contact | undefined }): ConnectionValidationResult {
    const from = context.findContact(fromId)
    const to = context.findContact(toId)
    
    if (!from || !to) {
      return {
        valid: false,
        errors: [`Contact not found: ${!from ? fromId : toId}`]
      }
    }
    
    if (!this.canConnect(from, to)) {
      return {
        valid: false,
        errors: [`Invalid connection: ${fromId} -> ${toId} (different groups without boundary)`]
      }
    }
    
    return { valid: true, errors: [] }
  }
}