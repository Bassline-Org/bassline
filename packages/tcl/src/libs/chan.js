// Channel commands - Tcl's I/O interface
// Provides chan subcommands for channel operations

import { formatList, parseList } from './list.js'
import { ChannelRegistry, createStdChannels, createStringChannel } from '../channel.js'

// Create channel commands for a runtime
export function createChanCommands(registry) {
  return {
    // chan subcommand ?args...?
    chan: (args, rt) => {
      const [subcmd, ...rest] = args

      const subcommands = {
        // chan create mode cmdPrefix - create reflected channel
        create: () => {
          const [mode, cmdPrefix] = rest
          // For reflected channels, cmdPrefix is called for operations
          // This is advanced functionality - simplified version
          return registry.create({
            readable: mode.includes('read') ? async () => null : null,
            writable: mode.includes('write') ? async () => {} : null,
          })
        },

        // chan close chanId ?direction?
        close: async () => {
          const [chanId, direction] = rest
          await registry.close(chanId, direction)
          return ''
        },

        // chan configure chanId ?options?
        configure: () => {
          const [chanId, ...opts] = rest
          const channel = registry.get(chanId)

          if (opts.length === 0) {
            // Return all options
            const config = channel.configure()
            const result = []
            for (const [key, value] of Object.entries(config)) {
              result.push(`-${key}`, String(value))
            }
            return formatList(result)
          }

          if (opts.length === 1) {
            // Return single option value
            const opt = opts[0].replace(/^-/, '')
            const config = channel.configure()
            return String(config[opt] ?? '')
          }

          // Set options
          const config = {}
          for (let i = 0; i < opts.length; i += 2) {
            const key = opts[i].replace(/^-/, '')
            config[key] = opts[i + 1]
          }
          channel.configure(config)
          return ''
        },

        // chan eof chanId
        eof: () => {
          const channel = registry.get(rest[0])
          return channel.eof ? '1' : '0'
        },

        // chan event chanId event ?script?
        event: () => {
          const [chanId, event, script] = rest
          const channel = registry.get(chanId)

          if (script === undefined) {
            // Return current handler
            return channel.handlers[event] ?? ''
          }

          if (script === '') {
            // Remove handler
            channel.setEvent(event, null)
          } else {
            // Set handler
            channel.setEvent(event, () => rt.run(script))
          }
          return ''
        },

        // chan flush chanId
        flush: async () => {
          const channel = registry.get(rest[0])
          await channel.flush()
          return ''
        },

        // chan gets chanId ?varName?
        gets: async () => {
          const [chanId, varName] = rest
          const channel = registry.get(chanId)
          const line = await channel.gets()

          if (line === null) {
            if (varName) {
              rt.setVar(varName, '')
              return '-1'
            }
            return ''
          }

          if (varName) {
            rt.setVar(varName, line)
            return String(line.length)
          }
          return line
        },

        // chan puts ?-nonewline? chanId string
        puts: async () => {
          let nonewline = false
          let idx = 0

          if (rest[0] === '-nonewline') {
            nonewline = true
            idx = 1
          }

          const chanId = rest[idx]
          const str = rest[idx + 1]
          const channel = registry.get(chanId)
          await channel.puts(str, !nonewline)
          return ''
        },

        // chan read chanId ?numChars?
        read: async () => {
          const [chanId, numChars] = rest
          const channel = registry.get(chanId)
          const data = await channel.read(numChars ? parseInt(numChars) : undefined)
          return data ?? ''
        },

        // chan seek chanId offset ?origin?
        seek: () => {
          // Seeking not supported for stream-based channels
          throw new Error('chan seek: not supported for this channel type')
        },

        // chan tell chanId
        tell: () => {
          // Position not tracked for stream-based channels
          return '-1'
        },

        // chan names ?pattern?
        names: () => {
          return formatList(registry.names(rest[0]))
        },

        // chan pending mode chanId
        pending: () => {
          const [mode, chanId] = rest
          const channel = registry.get(chanId)
          return String(channel.pending(mode))
        },

        // chan blocked chanId - check if last I/O blocked
        blocked: () => {
          const channel = registry.get(rest[0])
          return '0' // We're async, so never truly blocked
        },

        // chan copy inchan outchan ?options?
        copy: async () => {
          const [inChan, outChan, ...opts] = rest
          const inChannel = registry.get(inChan)
          const outChannel = registry.get(outChan)

          let size = -1
          for (let i = 0; i < opts.length; i += 2) {
            if (opts[i] === '-size') size = parseInt(opts[i + 1])
          }

          const data = await inChannel.read(size === -1 ? undefined : size)
          if (data) {
            await outChannel.puts(data, false)
          }
          return String(data?.length ?? 0)
        },

        // chan truncate chanId ?length?
        truncate: () => {
          throw new Error('chan truncate: not supported for this channel type')
        },
      }

      if (!subcmd || !subcommands[subcmd]) {
        throw new Error(`Unknown or ambiguous subcommand "${subcmd}"`)
      }

      return subcommands[subcmd]()
    },

    // Convenience commands that use the chan ensemble

    // gets chanId ?varName? - read line
    gets: async ([chanId, varName], rt) => {
      const channel = registry.get(chanId)
      const line = await channel.gets()

      if (line === null) {
        if (varName) {
          rt.setVar(varName, '')
          return '-1'
        }
        return ''
      }

      if (varName) {
        rt.setVar(varName, line)
        return String(line.length)
      }
      return line
    },

    // read chanId ?numChars?
    read: async ([chanId, numChars]) => {
      const channel = registry.get(chanId)
      const data = await channel.read(numChars ? parseInt(numChars) : undefined)
      return data ?? ''
    },

    // close chanId ?direction?
    close: async ([chanId, direction]) => {
      await registry.close(chanId, direction)
      return ''
    },

    // flush chanId
    flush: async ([chanId]) => {
      const channel = registry.get(chanId)
      await channel.flush()
      return ''
    },

    // eof chanId
    eof: ([chanId]) => {
      const channel = registry.get(chanId)
      return channel.eof ? '1' : '0'
    },

    // fconfigure chanId ?options? (alias for chan configure)
    fconfigure: (args, rt) => {
      return createChanCommands(registry).chan(['configure', ...args], rt)
    },

    // fileevent chanId event ?script?
    fileevent: (args, rt) => {
      return createChanCommands(registry).chan(['event', ...args], rt)
    },

    // open - create a file channel (simplified)
    open: ([name, access = 'r']) => {
      // In a real implementation, this would open files
      // For now, create a string channel
      if (name.startsWith('|')) {
        throw new Error('Pipe channels not supported')
      }
      throw new Error('File channels not yet implemented')
    },

    // socket - create network channel (placeholder)
    socket: () => {
      throw new Error('Socket channels not yet implemented')
    },
  }
}

// Helper to set up channels on a runtime
export function setupChannels(rt) {
  const registry = new ChannelRegistry()
  createStdChannels(registry)

  // Store registry on runtime for access
  rt.channels = registry

  // Register channel commands
  const cmds = createChanCommands(registry)
  for (const [name, fn] of Object.entries(cmds)) {
    rt.register(name, fn)
  }

  return registry
}

// Export for direct use
export { ChannelRegistry, createStdChannels, createStringChannel }
