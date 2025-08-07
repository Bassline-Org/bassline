import { Contradiction } from './index'

export type MergeResult<T> = 
  | { success: true; value: T }
  | { success: false; contradiction: Contradiction }

export function mergeSuccess<T>(value: T): MergeResult<T> {
  return { success: true, value }
}

export function mergeFailure<T>(contradiction: Contradiction): MergeResult<T> {
  return { success: false, contradiction }
}

export function isMergeSuccess<T>(result: MergeResult<T>): result is { success: true; value: T } {
  return result.success
}

export function isMergeFailure<T>(result: MergeResult<T>): result is { success: false; contradiction: Contradiction } {
  return !result.success
}