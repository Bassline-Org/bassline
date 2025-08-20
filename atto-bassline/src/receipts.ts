/**
 * Receipt tracking for audit trail of strength modifications
 */

import { Receipt } from './types'

// ============================================================================
// Receipt storage
// ============================================================================

const receipts: Receipt[] = []
let nextReceiptId = 1

// ============================================================================
// Receipt management
// ============================================================================

/**
 * Create a new receipt for strength modification
 */
export function createReceipt(
  gadgetId: string,
  amount: number,
  reason?: string
): Receipt {
  const receipt: Receipt = {
    id: `receipt-${nextReceiptId++}`,
    gadgetId,
    amount,
    timestamp: Date.now(),
    ...(reason && { reason })
  }
  
  receipts.push(receipt)
  return receipt
}

/**
 * Get all receipts
 */
export function getAllReceipts(): ReadonlyArray<Receipt> {
  return receipts
}

/**
 * Get receipts for a specific gadget
 */
export function getReceiptsForGadget(gadgetId: string): Receipt[] {
  return receipts.filter(r => r.gadgetId === gadgetId)
}

/**
 * Get receipts within a time window
 */
export function getReceiptsInWindow(startTime: number, endTime: number): Receipt[] {
  return receipts.filter(r => r.timestamp >= startTime && r.timestamp <= endTime)
}

/**
 * Calculate total amplification for a gadget
 */
export function getTotalAmplification(gadgetId: string): number {
  return getReceiptsForGadget(gadgetId)
    .reduce((sum, receipt) => sum + receipt.amount, 0)
}

/**
 * Clear all receipts (useful for testing)
 */
export function clearReceipts(): void {
  receipts.length = 0
  nextReceiptId = 1
}