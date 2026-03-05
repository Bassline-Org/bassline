import { message, fault } from './messages.js'

export async function sendTo(fn, aMessage) {
  const msg = message(aMessage);
  const result = await fn(msg);
  return message(result)
}
export const sendify = fn => msg => sendTo(fn, msg)

export async function send(target, msg, { timeout: ms = 30000, tap: taps = [] } = {}) {
  let timer
  try {
    const result = await Promise.race([
        sendTo(target, msg),
        new Promise((_, rej) => {
          timer = setTimeout(() => rej(fault('timeout', msg)), ms)
        }),
      ]);
    for (const t of taps) await t(result)
    return result
  } finally {
    clearTimeout(timer)
  }
}

export const all = targets => sendify(msg => Promise.all(targets.map(t => sendTo(t, msg))))

export const race = targets => sendify(msg => Promise.race(targets.map(t => sendTo(t, msg))))

export const tap = targets => sendify(async msg => {
  for(const target of targets) await sendTo(target, msg)
  return msg
})

export const thread = targets => sendify(async msg => {
  for(const target of targets) {
    const result = await sendTo(target, msg);
    if(!result.isEmpty) return result;
  }
})

export const pipe = targets => sendify(async msg => {
  let result = msg;
  for(const target of targets) {
    const res = await sendTo(target, result);
    if(res.isEmpty) continue;
    result = res;
  }
  return result
})

export const fallback = targets => sendify(async msg => {
  for (const target of targets) {
    try {
      const result = await sendTo(target, msg)
      if (!result.isEmpty) return result
    } catch (_) {}
  }
})

export const sife = (predicate, whenTrue, whenFalse) => sendify(async msg => {
  if (await predicate(msg)) {
    return whenTrue(msg)
  } else {
    return whenFalse?.(msg)
  }
})

export const when = (predicate, whenTrue) => sife(predicate, whenTrue)

export const retry =
  (target, times = 5, backoff = 5000) =>
  sendify(async msg => {
    let failures = 0
    while (true) {
      try {
        return message(await target(msg))
      } catch (e) {
        failures += 1
        if (failures >= times) throw e
        await new Promise(r => setTimeout(r, failures * backoff))
      }
    }
  })

export default { send, all, race, tap, thread, pipe, fallback, sife, retry }
