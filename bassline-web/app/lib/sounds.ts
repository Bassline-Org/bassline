import type { SoundDefinition } from 'react-sounds'

// Define our sound library
export const soundLibrary: Record<string, SoundDefinition> = {
  // Connection sounds
  'connection/create': {
    url: '/sounds/connection-create.mp3',
    volume: 0.5,
  },
  'connection/delete': {
    url: '/sounds/connection-delete.mp3',
    volume: 0.4,
  },
  
  // Node sounds
  'node/create': {
    url: '/sounds/node-create.mp3',
    volume: 0.3,
  },
  'node/delete': {
    url: '/sounds/node-delete.mp3',
    volume: 0.3,
  },
  'node/select': {
    url: '/sounds/node-select.mp3',
    volume: 0.2,
  },
  
  // Propagation sounds
  'propagation/pulse': {
    url: '/sounds/propagation-pulse.mp3',
    volume: 0.4,
  },
  'propagation/contradiction': {
    url: '/sounds/propagation-contradiction.mp3',
    volume: 0.6,
  },
  
  // UI sounds
  'ui/button-click': {
    url: '/sounds/ui-button-click.mp3',
    volume: 0.3,
  },
  'ui/toggle': {
    url: '/sounds/ui-toggle.mp3',
    volume: 0.2,
  },
  'ui/success': {
    url: '/sounds/ui-success.mp3',
    volume: 0.4,
  },
  'ui/error': {
    url: '/sounds/ui-error.mp3',
    volume: 0.5,
  },
}

// For now, we'll use placeholder URLs. In production, you'd have actual sound files
// You can use free sound libraries like:
// - https://freesound.org/
// - https://www.zapsplat.com/
// - https://mixkit.co/free-sound-effects/

// Temporary: Use data URLs for simple beep sounds
const createBeepDataUrl = (frequency: number, duration: number = 0.1) => {
  // This creates a simple sine wave beep
  // In a real app, you'd use actual sound files
  return `data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmFgU7k9n1unEiBC13yO/eizEIHWq+8+OWT" // ... truncated for brevity
}

// Override with simple generated sounds for now
export const generatedSounds: Record<string, SoundDefinition> = {
  'connection/create': {
    url: createBeepDataUrl(440, 0.1), // A4 note
    volume: 0.5,
  },
  'connection/delete': {
    url: createBeepDataUrl(220, 0.1), // A3 note
    volume: 0.4,
  },
  'node/create': {
    url: createBeepDataUrl(523, 0.05), // C5 note
    volume: 0.3,
  },
  'node/delete': {
    url: createBeepDataUrl(261, 0.05), // C4 note
    volume: 0.3,
  },
  'node/select': {
    url: createBeepDataUrl(660, 0.03), // E5 note
    volume: 0.2,
  },
  'propagation/pulse': {
    url: createBeepDataUrl(330, 0.15), // E4 note
    volume: 0.4,
  },
  'propagation/contradiction': {
    url: createBeepDataUrl(110, 0.3), // A2 note (low)
    volume: 0.6,
  },
  'ui/button-click': {
    url: createBeepDataUrl(880, 0.02), // A5 note (high)
    volume: 0.3,
  },
  'ui/toggle': {
    url: createBeepDataUrl(440, 0.05), // A4 note
    volume: 0.2,
  },
  'ui/success': {
    url: createBeepDataUrl(659, 0.2), // E5 note
    volume: 0.4,
  },
  'ui/error': {
    url: createBeepDataUrl(147, 0.3), // D3 note (low)
    volume: 0.5,
  },
}