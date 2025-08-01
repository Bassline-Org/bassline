import type { BlendMode } from './types';

export class AcceptLastValue implements BlendMode {
  name = 'AcceptLastValue';

  blend(current: any, incoming: any): any {
    return incoming;
  }
}

export class KeepFirstValue implements BlendMode {
  name = 'KeepFirstValue';

  blend(current: any, incoming: any): any {
    return current;
  }
}

export class NumericSum implements BlendMode {
  name = 'NumericSum';

  blend(current: any, incoming: any): any {
    if (typeof current === 'number' && typeof incoming === 'number') {
      return current + incoming;
    }
    throw new Error('NumericSum can only blend numbers');
  }
}

export class SetUnion implements BlendMode {
  name = 'SetUnion';

  blend(current: any, incoming: any): any {
    if (current instanceof Set && incoming instanceof Set) {
      return new Set([...current, ...incoming]);
    }
    if (Array.isArray(current) && Array.isArray(incoming)) {
      return [...new Set([...current, ...incoming])];
    }
    throw new Error('SetUnion can only blend Sets or Arrays');
  }
}

export class Contradiction implements BlendMode {
  name = 'Contradiction';

  blend(current: any, incoming: any): any {
    if (current !== incoming) {
      throw new Error(`Contradiction: ${current} !== ${incoming}`);
    }
    return current;
  }
}

export const DEFAULT_BLEND_MODE = new AcceptLastValue();