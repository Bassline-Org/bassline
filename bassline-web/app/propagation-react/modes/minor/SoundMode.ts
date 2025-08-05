/**
 * SoundMode - Plays sound effects for various actions
 */

import { MinorModeBase } from '../MinorModeBase'
import type { ModeContext, Command } from '../types'

export class SoundMode extends MinorModeBase {
  id = 'sound'
  name = 'Sound'
  icon = '🔊'
  description = 'Audio feedback for actions'
  
  // Sound mappings to SoundSystem sound names
  private soundMap = {
    connect: 'connection/create',
    disconnect: 'connection/delete',
    create: 'node/create',
    delete: 'node/delete',
    move: 'node/select',
    select: 'node/select',
    enterGadget: 'gadget/enter',
    exitGadget: 'gadget/exit',
    createGadget: 'gadget/create',
    deleteGadget: 'gadget/delete',
    inlineGadget: 'gadget/inline'
  }
  
  onEnable(_context: ModeContext): void {
    // Mode enabled - sound system will handle playing sounds
    // The sound system checks if this mode is active before playing
  }
  
  onDisable(_context: ModeContext): void {
    // Mode disabled - sounds will stop playing automatically
  }
  
  afterCommand(command: Command, _result: any, _context: ModeContext): void {
    // Sound playing is handled by the components themselves
    // The SoundSystem checks if this mode is active
    // This method is kept for potential future enhancements
  }
  
  // Note: The actual sound playing is handled by the SoundSystem
  // which checks if this mode is active before playing any sounds.
  // Components use the useSoundSystem hook to play sounds,
  // and the SoundSystem automatically checks modeSystem.activeMinorModes
}