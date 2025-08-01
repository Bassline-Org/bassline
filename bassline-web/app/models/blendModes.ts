import type { BlendMode } from "./types";

export class AcceptLastValue implements BlendMode {
  name = "AcceptLastValue";

  blend(current: any, incoming: any): any {
    return incoming;
  }
}

export const DEFAULT_BLEND_MODE = new AcceptLastValue();
