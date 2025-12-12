import { createTimerRoutes } from './timer.js'

/**
 * Install timers into a Bassline instance.
 * Timers dispatch tick events through the plumber.
 *
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} [config] - Configuration options (unused)
 */
export default function installTimers(bl, config = {}) {
  const timers = createTimerRoutes({
    onTick: ({ name, tick, time }) => {
      bl._plumber?.dispatch({
        uri: `bl:///timers/${name}`,
        headers: { type: 'bl:///types/timer-tick' },
        body: {
          timer: name,
          tick,
          time,
        },
      })
    },
  })

  timers.install(bl)
  bl._timers = timers

  console.log('Timers installed')
}
