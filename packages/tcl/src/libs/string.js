import { std } from './std.js'

export const commands = {
  length: ([str]) => String(str?.length ?? 0),
  concat: ([...strs]) => strs.join(''),
  compare: ([a, b]) => String(a === b ? 0 : a < b ? -1 : 1),
  equal: ([a, b]) => String(a === b ? 1 : 0),
  first: ([str]) => String(str?.[0] ?? ''),
  last: ([str]) => String(str?.[str.length - 1] ?? ''),
  index: ([str, index]) => String(str?.[parseInt(index, 10)] ?? ''),
  range: ([str, start, end]) => String(str.slice(parseInt(start, 10), parseInt(end, 10))),
  repeat: ([str, count]) => {
    let result = ''
    for (let i = 0; i < parseInt(count, 10); i++) {
      result += str
    }
    return result
  },
  replace: ([str, regexStr, repl]) => {
    const match = regexStr.match(/^\/(.*)\/([a-z]*)$/i)
    if (!match) {
      throw new Error('Invalid regex string format. Use /pattern/flags')
    }
    const [, pattern, flags] = match
    return String(str.replace(new RegExp(pattern, flags), repl))
  },
  reverse: ([str]) => str.split('').reverse().join(''),
  tolower: ([str]) => str.toLowerCase(),
  toupper: ([str]) => str.toUpperCase(),
  trim: ([str]) => str.trim(),
  trimleft: ([str]) => str.trimLeft(),
  trimright: ([str]) => str.trimRight(),
  wordstart: ([str]) => str.search(/\s\w/),
  wordend: ([str]) => str.search(/\w\b/),
}

export const stringCommand = ([subcmd, ...rest]) => {
  return commands[subcmd](rest) ?? std.puts(`string: unknown subcommand ${subcmd}`)
}

export const string = {
  string: stringCommand,
}
