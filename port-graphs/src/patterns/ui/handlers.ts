import { Arrow, Gadget, EffectsOf, Handler } from '../../core/context';
import { mergeHandler } from '../cells';

// ================================================
// UI Handlers
// ================================================

// Standard handler for UI gadgets - merges state and lets metadata flow to taps
export const uiHandler = mergeHandler;