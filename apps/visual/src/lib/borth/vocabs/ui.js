/**
 * UI Vocabulary - Blocking interaction words for cards
 *
 * Provides words that pause card execution until user completes an interaction.
 * Cancellation calls exit() to abort the current card execution.
 */

import { Vocab, exit } from '../primitives.js'

export function createUiVocab(rt) {
  const vocab = new Vocab('ui')
  const saved = rt.current
  rt.current = vocab

  // Helper: resolve interaction or exit on cancel
  const interact = async (type, config) => {
    if (!rt.handleInteraction) {
      throw new Error('No interaction handler configured')
    }
    const result = await rt.handleInteraction(type, config)
    if (result === null) exit() // User cancelled - abort card
    return result
  }

  // prompt ( label -- text )
  // Show text input dialog, return user's text. Exits on cancel.
  rt.def('prompt', async label => {
    return [await interact('prompt', { label })]
  })

  // prompt-default ( label default -- text )
  // Show text input dialog with default value. Exits on cancel.
  rt.def('prompt-default', async (label, defaultValue) => {
    return [await interact('prompt', { label, defaultValue })]
  })

  // confirm ( message -- bool )
  // Show yes/no dialog, return true/false. Exits on cancel (X button).
  rt.def('confirm', async message => {
    return [await interact('confirm', { message })]
  })

  // confirm-title ( title message -- bool )
  // Show yes/no dialog with custom title. Exits on cancel.
  rt.def('confirm-title', async (title, message) => {
    return [await interact('confirm', { title, message })]
  })

  // edit ( text -- text )
  // Show text editor, return edited text. Exits on cancel.
  rt.def('edit', async text => {
    return [await interact('edit', { text })]
  })

  // edit-title ( title text -- text )
  // Show text editor with custom title. Exits on cancel.
  rt.def('edit-title', async (title, text) => {
    return [await interact('edit', { title, text })]
  })

  rt.current = saved
  return vocab
}
