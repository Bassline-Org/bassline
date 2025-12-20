// List commands - strings that represent lists (EIAS)
// Lists are space-delimited words. Braces {} or quotes "" group words.

// Parse a Tcl list string into an array of elements
export function parseList(str) {
  if (!str || typeof str !== 'string') return []
  str = str.trim()
  if (!str) return []

  const result = []
  let i = 0

  while (i < str.length) {
    // Skip whitespace
    while (i < str.length && /\s/.test(str[i])) i++
    if (i >= str.length) break

    let element = ''

    if (str[i] === '{') {
      // Braced element - find matching close brace
      let depth = 1
      i++ // skip opening brace
      const start = i
      while (i < str.length && depth > 0) {
        if (str[i] === '\\' && i + 1 < str.length) {
          i += 2 // skip escaped char
        } else if (str[i] === '{') {
          depth++
          i++
        } else if (str[i] === '}') {
          depth--
          if (depth > 0) i++
        } else {
          i++
        }
      }
      element = str.slice(start, i)
      i++ // skip closing brace
    } else if (str[i] === '"') {
      // Quoted element
      i++ // skip opening quote
      while (i < str.length && str[i] !== '"') {
        if (str[i] === '\\' && i + 1 < str.length) {
          element += str[i + 1]
          i += 2
        } else {
          element += str[i]
          i++
        }
      }
      i++ // skip closing quote
    } else {
      // Bare word - read until whitespace
      while (i < str.length && !/\s/.test(str[i])) {
        if (str[i] === '\\' && i + 1 < str.length) {
          element += str[i + 1]
          i += 2
        } else {
          element += str[i]
          i++
        }
      }
    }

    result.push(element)
  }

  return result
}

// Format an array into a Tcl list string
export function formatList(arr) {
  if (!Array.isArray(arr)) return String(arr)

  return arr
    .map(elem => {
      const s = String(elem)
      // Empty string needs braces
      if (s === '') return '{}'
      // If contains whitespace, braces, or special chars, brace it
      if (/[\s{}\\"]/.test(s) || s.includes('$') || s.includes('[')) {
        return `{${s}}`
      }
      return s
    })
    .join(' ')
}

// Normalize list index - handles "end", "end-N", negative indices
function normalizeIndex(idx, len) {
  if (typeof idx === 'string') {
    if (idx === 'end') return len - 1
    if (idx.startsWith('end-')) {
      const n = parseInt(idx.slice(4))
      return len - 1 - n
    }
    if (idx.startsWith('end+')) {
      const n = parseInt(idx.slice(4))
      return len - 1 + n
    }
    idx = parseInt(idx)
  }
  if (idx < 0) return len + idx
  return idx
}

export const list = {
  // list ?arg ...? - create list from arguments
  list: args => formatList(args),

  // llength list - return number of elements
  llength: ([listStr]) => String(parseList(listStr).length),

  // lindex list ?idx ...? - get element at index (supports nested)
  lindex: args => {
    let list = parseList(args[0])
    for (let i = 1; i < args.length; i++) {
      const idx = normalizeIndex(args[i], list.length)
      const elem = list[idx]
      if (elem === undefined) return ''
      if (i < args.length - 1) {
        list = parseList(elem)
      } else {
        return elem
      }
    }
    return formatList(list)
  },

  // lrange list first last - extract sublist
  lrange: ([listStr, first, last]) => {
    const list = parseList(listStr)
    const start = normalizeIndex(first, list.length)
    const end = normalizeIndex(last, list.length)
    return formatList(list.slice(Math.max(0, start), end + 1))
  },

  // lappend varName ?value ...? - append to list in variable
  lappend: (args, rt) => {
    const [varName, ...values] = args
    let list
    try {
      list = parseList(rt.getVar(varName))
    } catch {
      list = []
    }
    list.push(...values)
    const result = formatList(list)
    rt.setVar(varName, result)
    return result
  },

  // linsert list index ?element ...? - insert elements
  linsert: args => {
    const [listStr, indexStr, ...elements] = args
    const list = parseList(listStr)
    let index = normalizeIndex(indexStr, list.length)
    if (index < 0) index = 0
    if (index > list.length) index = list.length
    list.splice(index, 0, ...elements)
    return formatList(list)
  },

  // lreplace list first last ?element ...? - replace elements
  lreplace: args => {
    const [listStr, first, last, ...elements] = args
    const list = parseList(listStr)
    const start = normalizeIndex(first, list.length)
    const end = normalizeIndex(last, list.length)
    list.splice(start, end - start + 1, ...elements)
    return formatList(list)
  },

  // lset varName ?index ...? value - set element in list variable
  lset: (args, rt) => {
    const varName = args[0]
    const value = args[args.length - 1]
    const indices = args.slice(1, -1)

    let list = parseList(rt.getVar(varName))

    if (indices.length === 0) {
      // Replace entire list
      rt.setVar(varName, value)
      return value
    }

    // Navigate to the right element
    let current = list
    for (let i = 0; i < indices.length - 1; i++) {
      const idx = normalizeIndex(indices[i], current.length)
      current[idx] = parseList(current[idx])
      current = current[idx]
    }

    const lastIdx = normalizeIndex(indices[indices.length - 1], current.length)
    current[lastIdx] = value

    // Rebuild the list string
    const rebuild = arr => formatList(arr.map(el => (Array.isArray(el) ? rebuild(el) : el)))
    const result = rebuild(list)
    rt.setVar(varName, result)
    return result
  },

  // lsort ?options? list - sort list
  lsort: args => {
    // Parse options
    let opts = { order: 'increasing', type: 'ascii' }
    let listStr = args[args.length - 1]

    for (let i = 0; i < args.length - 1; i++) {
      const opt = args[i]
      if (opt === '-decreasing') opts.order = 'decreasing'
      else if (opt === '-increasing') opts.order = 'increasing'
      else if (opt === '-integer') opts.type = 'integer'
      else if (opt === '-real') opts.type = 'real'
      else if (opt === '-ascii') opts.type = 'ascii'
      else if (opt === '-dictionary') opts.type = 'dictionary'
      else if (opt === '-unique') opts.unique = true
    }

    let list = parseList(listStr)

    // Sort
    list.sort((a, b) => {
      let cmp
      if (opts.type === 'integer') {
        cmp = parseInt(a) - parseInt(b)
      } else if (opts.type === 'real') {
        cmp = parseFloat(a) - parseFloat(b)
      } else if (opts.type === 'dictionary') {
        // Case-insensitive, numbers sort by value
        cmp = a.toLowerCase().localeCompare(b.toLowerCase(), undefined, { numeric: true })
      } else {
        cmp = a.localeCompare(b)
      }
      return opts.order === 'decreasing' ? -cmp : cmp
    })

    // Remove duplicates if -unique
    if (opts.unique) {
      list = [...new Set(list)]
    }

    return formatList(list)
  },

  // lsearch ?options? list pattern - find element
  lsearch: args => {
    let opts = { mode: 'glob', all: false }
    let listStr, pattern

    // Parse options
    let i = 0
    while (i < args.length - 2) {
      const opt = args[i]
      if (opt === '-exact') opts.mode = 'exact'
      else if (opt === '-glob') opts.mode = 'glob'
      else if (opt === '-regexp') opts.mode = 'regexp'
      else if (opt === '-all') opts.all = true
      else if (opt === '-inline') opts.inline = true
      else if (opt === '-not') opts.not = true
      i++
    }

    listStr = args[args.length - 2]
    pattern = args[args.length - 1]

    // If only one arg left, it's the list and pattern is missing
    if (args.length === 1) {
      return '-1'
    }

    const list = parseList(listStr)
    const matches = []

    for (let j = 0; j < list.length; j++) {
      let match = false
      if (opts.mode === 'exact') {
        match = list[j] === pattern
      } else if (opts.mode === 'glob') {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
        match = regex.test(list[j])
      } else if (opts.mode === 'regexp') {
        match = new RegExp(pattern).test(list[j])
      }

      if (opts.not) match = !match

      if (match) {
        if (opts.all) {
          matches.push(opts.inline ? list[j] : String(j))
        } else {
          return opts.inline ? list[j] : String(j)
        }
      }
    }

    if (opts.all) return formatList(matches)
    return '-1'
  },

  // lreverse list - reverse list
  lreverse: ([listStr]) => formatList(parseList(listStr).reverse()),

  // lmap varName list body - functional map
  lmap: ([varName, listStr, body], rt) => {
    const list = parseList(listStr)
    const results = []
    for (const elem of list) {
      rt.setVar(varName, elem)
      const result = rt.run(body)
      if (result !== '') results.push(result)
    }
    return formatList(results)
  },

  // join list ?separator? - join list elements
  join: ([listStr, sep = ' ']) => parseList(listStr).join(sep),

  // split string ?chars? - split string into list
  split: ([str, chars]) => {
    if (!chars) {
      // Split on each character
      return formatList(str.split(''))
    }
    // Split on any character in chars
    const regex = new RegExp(`[${chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`)
    return formatList(str.split(regex))
  },

  // concat ?list ...? - concatenate lists
  concat: args => {
    const result = []
    for (const arg of args) {
      result.push(...parseList(arg))
    }
    return formatList(result)
  },
}
