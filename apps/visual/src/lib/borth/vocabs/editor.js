// editor vocab - Command system, keybindings, settings
import { Vocab, panic } from '../primitives.js'

const WS = ' \t\n\r'
const isWS = c => WS.includes(c)

export function createEditorVocab(rt) {
  const vocab = new Vocab('editor')
  const saved = rt.current
  rt.current = vocab

  // cmd - mark last word as a command
  rt.def('cmd', () => {
    if (rt.last) rt.last.attributes.command = true
  }, true)

  // doc{ - parse doc string until }
  rt.def('doc{', () => {
    const doc = rt.parse(c => c === '}')
    if (rt.last) rt.last.attributes.doc = doc.trim()
  }, true)

  // key: - set keybinding (next token)
  rt.def('key:', () => {
    const key = rt.parse(isWS)
    if (rt.last) rt.last.attributes.key = key
  }, true)

  // menu: - set menu path
  rt.def('menu:', () => {
    const menu = rt.parse(isWS)
    if (rt.last) rt.last.attributes.menu = menu
  }, true)

  // icon: - set icon identifier
  rt.def('icon:', () => {
    const icon = rt.parse(isWS)
    if (rt.last) rt.last.attributes.icon = icon
  }, true)

  // when: - set visibility condition word
  rt.def('when:', () => {
    const when = rt.parse(isWS)
    if (rt.last) rt.last.attributes.when = when
  }, true)

  // category: - set category
  rt.def('category:', () => {
    const category = rt.parse(isWS)
    if (rt.last) rt.last.attributes.category = category
  }, true)

  // on: - set hook event
  rt.def('on:', () => {
    if (rt.last) rt.last.attributes.hook = rt.parse(isWS)
  }, true)

  // priority: - set priority for hooks
  rt.def('priority:', () => {
    const priority = rt.parse(isWS)
    if (rt.last) rt.last.attributes.priority = parseInt(priority, 10)
  }, true)

  // every: - set interval for scheduled tasks and start a chron
  rt.def('every:', () => {
    const interval = rt.parse(isWS)
    const match = interval.match(/^(\d+)(s|m|h|d)$/)
    if (match) {
      const [, num, unit] = match
      const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 }
      const ms = parseInt(num, 10) * multipliers[unit]
      if (rt.last) {
        const chronName = rt.last.name
        rt.last.attributes.interval = ms
        rt.last.attributes.hook = `chron:${chronName}`
        rt.startChron(chronName, ms)
      }
    } else {
      panic(`invalid interval: ${interval}`)
    }
  }, true)

  // setting - mark variable as a setting
  rt.def('setting', () => {
    if (rt.last) rt.last.attributes.setting = true
  }, true)

  // type: - set setting type
  rt.def('type:', () => {
    const type = rt.parse(isWS)
    if (rt.last) rt.last.attributes.settingType = type
  }, true)

  // min: / max: / step: - numeric constraints
  rt.def('min:', () => {
    const min = rt.parse(isWS)
    if (rt.last) rt.last.attributes.min = parseFloat(min)
  }, true)

  rt.def('max:', () => {
    const max = rt.parse(isWS)
    if (rt.last) rt.last.attributes.max = parseFloat(max)
  }, true)

  rt.def('step:', () => {
    const step = rt.parse(isWS)
    if (rt.last) rt.last.attributes.step = parseFloat(step)
  }, true)

  rt.def('choices:', choices => {
    if (rt.last) rt.last.attributes.choices = choices
  })

  // query - run database query (requires rt.db to be set)
  rt.def('query', async (params, sql) => {
    if (!rt.db) panic('database not available')
    const result = await rt.db.query(sql, params)
    if (result.error) panic(result.error)
    return [result.data]
  })

  rt.current = saved
  return vocab
}
