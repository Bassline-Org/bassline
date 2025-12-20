// Channel - Tcl's I/O abstraction
// Channels are bidirectional byte streams with buffering, encoding, and events

export class Channel {
  constructor(id, opts = {}) {
    this.id = id
    this.readable = opts.readable ?? null // Read function or stream
    this.writable = opts.writable ?? null // Write function or stream
    this.buffer = '' // Input buffer
    this.writeBuffer = '' // Output buffer
    this.eof = false
    this.closed = false

    // Configuration
    this.blocking = opts.blocking ?? true
    this.buffering = opts.buffering ?? 'full' // full, line, none
    this.buffersize = opts.buffersize ?? 4096
    this.encoding = opts.encoding ?? 'utf-8'
    this.translation = opts.translation ?? 'auto' // auto, lf, cr, crlf

    // Event handlers
    this.handlers = {
      readable: null,
      writable: null,
    }
  }

  // Configure channel options
  configure(opts) {
    if (opts === undefined) {
      // Return current configuration
      return {
        blocking: this.blocking,
        buffering: this.buffering,
        buffersize: this.buffersize,
        encoding: this.encoding,
        translation: this.translation,
      }
    }

    for (const [key, value] of Object.entries(opts)) {
      switch (key) {
        case 'blocking':
          this.blocking = value === 'true' || value === '1' || value === true
          break
        case 'buffering':
          if (!['full', 'line', 'none'].includes(value)) {
            throw new Error(`Invalid buffering mode: ${value}`)
          }
          this.buffering = value
          break
        case 'buffersize':
          this.buffersize = parseInt(value)
          break
        case 'encoding':
          this.encoding = value
          break
        case 'translation':
          if (!['auto', 'lf', 'cr', 'crlf', 'binary'].includes(value)) {
            throw new Error(`Invalid translation mode: ${value}`)
          }
          this.translation = value
          break
      }
    }
  }

  // Translate line endings based on translation mode
  translateInput(str) {
    switch (this.translation) {
      case 'lf':
        return str
      case 'cr':
        return str.replace(/\r/g, '\n')
      case 'crlf':
        return str.replace(/\r\n/g, '\n')
      case 'auto':
        return str.replace(/\r\n?/g, '\n')
      default:
        return str
    }
  }

  translateOutput(str) {
    switch (this.translation) {
      case 'lf':
        return str
      case 'cr':
        return str.replace(/\n/g, '\r')
      case 'crlf':
        return str.replace(/\n/g, '\r\n')
      default:
        return str
    }
  }

  // Read data into buffer
  async fillBuffer() {
    if (this.eof || !this.readable) return

    if (typeof this.readable === 'function') {
      const data = await this.readable(this.buffersize)
      if (data === null || data === undefined) {
        this.eof = true
      } else {
        this.buffer += this.translateInput(data)
      }
    } else if (this.readable.read) {
      // Node.js stream
      const data = this.readable.read(this.buffersize)
      if (data === null) {
        this.eof = true
      } else {
        this.buffer += this.translateInput(data.toString(this.encoding))
      }
    }
  }

  // Read a line (up to and including newline)
  async gets() {
    while (!this.eof) {
      const newlinePos = this.buffer.indexOf('\n')
      if (newlinePos !== -1) {
        const line = this.buffer.slice(0, newlinePos)
        this.buffer = this.buffer.slice(newlinePos + 1)
        return line
      }
      await this.fillBuffer()
    }

    // EOF - return remaining buffer
    if (this.buffer.length > 0) {
      const line = this.buffer
      this.buffer = ''
      return line
    }
    return null
  }

  // Read numChars characters (or all if not specified)
  async read(numChars) {
    if (numChars === undefined) {
      // Read all remaining
      while (!this.eof) {
        await this.fillBuffer()
      }
      const data = this.buffer
      this.buffer = ''
      return data
    }

    // Read specific number of characters
    while (this.buffer.length < numChars && !this.eof) {
      await this.fillBuffer()
    }

    const data = this.buffer.slice(0, numChars)
    this.buffer = this.buffer.slice(numChars)
    return data
  }

  // Write string to channel
  async puts(str, newline = true) {
    if (this.closed || !this.writable) {
      throw new Error(`Channel ${this.id} is not writable`)
    }

    let data = this.translateOutput(str)
    if (newline) data += this.translateOutput('\n')

    if (this.buffering === 'none') {
      await this.writeImmediate(data)
    } else if (this.buffering === 'line') {
      this.writeBuffer += data
      if (data.includes('\n')) {
        await this.flush()
      }
    } else {
      // Full buffering
      this.writeBuffer += data
      if (this.writeBuffer.length >= this.buffersize) {
        await this.flush()
      }
    }
  }

  // Write immediately
  async writeImmediate(data) {
    if (typeof this.writable === 'function') {
      await this.writable(data)
    } else if (this.writable.write) {
      // Node.js stream
      await new Promise((resolve, reject) => {
        this.writable.write(data, this.encoding, err => {
          if (err) reject(err)
          else resolve()
        })
      })
    }
  }

  // Flush output buffer
  async flush() {
    if (this.writeBuffer.length > 0) {
      await this.writeImmediate(this.writeBuffer)
      this.writeBuffer = ''
    }
  }

  // Close channel
  async close(direction) {
    if (direction === 'read' && this.readable) {
      if (this.readable.destroy) this.readable.destroy()
      this.readable = null
    } else if (direction === 'write' && this.writable) {
      await this.flush()
      if (this.writable.end) this.writable.end()
      this.writable = null
    } else {
      // Close both
      await this.flush()
      if (this.readable?.destroy) this.readable.destroy()
      if (this.writable?.end) this.writable.end()
      this.readable = null
      this.writable = null
      this.closed = true
    }
  }

  // Set event handler
  setEvent(event, handler) {
    if (event !== 'readable' && event !== 'writable') {
      throw new Error(`Invalid event type: ${event}`)
    }
    this.handlers[event] = handler
  }

  // Check pending bytes
  pending(mode) {
    if (mode === 'input') {
      return this.buffer.length
    } else if (mode === 'output') {
      return this.writeBuffer.length
    }
    return 0
  }
}

// Channel registry
export class ChannelRegistry {
  constructor() {
    this.channels = new Map()
    this.nextId = 0
  }

  // Create a new channel
  create(opts = {}) {
    const id = opts.id ?? `chan${++this.nextId}`
    const channel = new Channel(id, opts)
    this.channels.set(id, channel)
    return id
  }

  // Get channel by ID
  get(id) {
    const channel = this.channels.get(id)
    if (!channel) throw new Error(`Channel "${id}" does not exist`)
    return channel
  }

  // Check if channel exists
  has(id) {
    return this.channels.has(id)
  }

  // Close and remove channel
  async close(id, direction) {
    const channel = this.get(id)
    await channel.close(direction)
    if (channel.closed) {
      this.channels.delete(id)
    }
  }

  // List channel names
  names(pattern) {
    let ids = [...this.channels.keys()]
    if (pattern) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
      ids = ids.filter(id => regex.test(id))
    }
    return ids
  }
}

// Create standard channels for Node.js environment
export function createStdChannels(registry) {
  if (typeof process !== 'undefined') {
    // Node.js environment
    registry.channels.set(
      'stdin',
      new Channel('stdin', {
        readable: async size => {
          return new Promise(resolve => {
            const chunk = process.stdin.read(size)
            if (chunk !== null) {
              resolve(chunk.toString())
            } else {
              process.stdin.once('readable', () => {
                const data = process.stdin.read(size)
                resolve(data ? data.toString() : null)
              })
              process.stdin.once('end', () => resolve(null))
            }
          })
        },
        blocking: true,
        buffering: 'line',
      })
    )

    registry.channels.set(
      'stdout',
      new Channel('stdout', {
        writable: data => process.stdout.write(data),
        blocking: false,
        buffering: 'line',
      })
    )

    registry.channels.set(
      'stderr',
      new Channel('stderr', {
        writable: data => process.stderr.write(data),
        blocking: false,
        buffering: 'none',
      })
    )
  }
}

// Create an in-memory channel (useful for testing and string I/O)
export function createStringChannel(registry, content = '') {
  let readPos = 0
  const id = registry.create({
    readable: async size => {
      if (readPos >= content.length) return null
      const chunk = content.slice(readPos, readPos + size)
      readPos += chunk.length
      return chunk
    },
    writable: data => {
      content += data
    },
  })
  return id
}
