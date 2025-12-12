import { createTimerRoutes } from './timer.js'

/**
 * Install timers into a Bassline instance.
 * Timers send tick events through the plumber.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default function installTimers(bl) {
  const timers = createTimerRoutes({ bl })

  timers.install(bl)
  bl.setModule('timers', timers)

  console.log('Timers installed')
}
