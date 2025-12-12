import { createTimerRoutes } from './timer.js'

/**
 * Install timers into a Bassline instance.
 * Timers send tick events through the plumber.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default function installTimers(bl) {
  const timers = createTimerRoutes({
    onTick: ({ name, tick, time }) => {
      bl.put(
        'bl:///plumb/send',
        { source: `bl:///timers/${name}`, port: `timer-${name}` },
        {
          headers: { type: 'bl:///types/timer-tick' },
          body: { timer: name, tick, time },
        }
      )
    },
  })

  timers.install(bl)
  bl._timers = timers

  console.log('Timers installed')
}
