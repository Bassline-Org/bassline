import { resource, routes, bind } from './resource.js'

/**
 * Create a timers resource for time-based events
 *
 * Timers dispatch ticks via kit to /tick (semantic path).
 * The kit maps this to wherever ticks should go.
 *
 * Routes:
 *   GET  /            → bassline describing timers
 *   GET  /:name       → get timer config
 *   PUT  /:name       → create/update timer { interval, enabled }
 *   PUT  /:name/start → start the timer
 *   PUT  /:name/stop  → stop the timer
 */
export const createTimers = () => {
  const timers = new Map()

  const startTimer = (name, config, kit) => {
    const timer = timers.get(name)
    if (timer?.handle) clearInterval(timer.handle)

    const handle = setInterval(async () => {
      config.tickCount = (config.tickCount ?? 0) + 1
      if (kit) {
        await kit.put(
          { path: '/tick' },
          {
            timer: name,
            tick: config.tickCount,
            time: Date.now(),
          }
        )
      }
    }, config.interval)

    config.running = true
    timers.set(name, { config, handle, kit })
  }

  const stopTimer = name => {
    const timer = timers.get(name)
    if (timer?.handle) {
      clearInterval(timer.handle)
      timer.config.running = false
      timer.handle = null
    }
  }

  return routes({
    '': resource({
      get: async () => ({
        headers: { type: '/types/bassline' },
        body: {
          name: 'timers',
          description: 'Time-based event dispatch',
          resources: Object.fromEntries([...timers.keys()].map(k => [`/${k}`, {}])),
        },
      }),
    }),

    unknown: bind(
      'name',
      routes({
        '': resource({
          get: async h => {
            const timer = timers.get(h.params.name)
            if (!timer) return { headers: { condition: 'not-found' }, body: null }
            return { headers: { type: '/types/timer' }, body: timer.config }
          },
          put: async (h, body) => {
            const name = h.params.name
            stopTimer(name)

            const config = {
              interval: body.interval,
              enabled: body.enabled ?? false,
              tickCount: 0,
              running: false,
            }

            timers.set(name, { config, handle: null, kit: h.kit })

            if (config.enabled && h.kit) {
              startTimer(name, config, h.kit)
            }

            return { headers: {}, body: config }
          },
        }),

        start: resource({
          put: async h => {
            const timer = timers.get(h.params.name)
            if (!timer) return { headers: { condition: 'not-found' }, body: null }
            const kit = h.kit ?? timer.kit
            if (kit) startTimer(h.params.name, timer.config, kit)
            return { headers: {}, body: timer.config }
          },
        }),

        stop: resource({
          put: async h => {
            const timer = timers.get(h.params.name)
            if (!timer) return { headers: { condition: 'not-found' }, body: null }
            stopTimer(h.params.name)
            return { headers: {}, body: timer.config }
          },
        }),
      })
    ),
  })
}

export default createTimers
