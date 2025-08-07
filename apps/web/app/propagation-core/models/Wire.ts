import type { WireId, ContactId, WireType } from '../types'

export class Wire {
  constructor(
    public readonly id: WireId,
    public readonly fromId: ContactId,
    public readonly toId: ContactId,
    public readonly type: WireType = 'bidirectional'
  ) {}
}