export const PROTOCOL_VERSION = 1

export const OPCODE = {
  REQUEST: 'REQUEST',
  RESPONSE: 'RESPONSE',
}

export const ERROR_CODE = {
  PROTOCOL: 'E_PROTOCOL',
  TARGET: 'E_TARGET',
  CLOSED: 'E_CLOSED',
  INTERNAL: 'E_INTERNAL',
  TIMEOUT: 'E_TIMEOUT',
}

/**
 * @param {{ id: string, msg: unknown, targetRef?: string }} frame
 */
export function encodeRequest({ id, msg, targetRef }) {
  return {
    v: PROTOCOL_VERSION,
    id,
    op: OPCODE.REQUEST,
    msg,
    ...(targetRef ? { targetRef } : {}),
  }
}

/**
 * @param {{ id: string, result: unknown }} frame
 */
export function encodeResponseSuccess({ id, result }) {
  return {
    v: PROTOCOL_VERSION,
    id,
    op: OPCODE.RESPONSE,
    ok: true,
    result,
  }
}

/**
 * @param {{ id: string, code: string, message: string }} frame
 */
export function encodeResponseError({ id, code, message }) {
  return {
    v: PROTOCOL_VERSION,
    id,
    op: OPCODE.RESPONSE,
    ok: false,
    error: { code, message },
  }
}

/**
 * @param {{ code: string, message: string, id?: string }} err
 */
function fail(err) {
  return { ok: false, ...err }
}

/**
 * Parse and validate a transport frame.
 *
 * @param {unknown} frame
 * @returns {{ ok: true, frame: any } | { ok: false, code: string, message: string, id?: string }}
 */
export function parseEnvelope(frame) {
  if (frame && typeof frame === 'object' && frame.__parseError) {
    return fail({
      code: ERROR_CODE.PROTOCOL,
      message: 'malformed JSON frame',
    })
  }

  if (frame === null || typeof frame !== 'object' || Array.isArray(frame)) {
    return fail({
      code: ERROR_CODE.PROTOCOL,
      message: 'frame must be an object',
    })
  }

  const { v, id, op } = frame

  if (v !== PROTOCOL_VERSION) {
    return fail({
      code: ERROR_CODE.PROTOCOL,
      message: `unsupported protocol version: ${String(v)}`,
      ...(typeof id === 'string' ? { id } : {}),
    })
  }

  if (typeof id !== 'string' || id.length === 0) {
    return fail({
      code: ERROR_CODE.PROTOCOL,
      message: 'frame id required',
    })
  }

  if (op === OPCODE.REQUEST) {
    if (!('msg' in frame)) {
      return fail({
        code: ERROR_CODE.PROTOCOL,
        message: 'request msg required',
        id,
      })
    }

    if ('targetRef' in frame && frame.targetRef !== undefined && typeof frame.targetRef !== 'string') {
      return fail({
        code: ERROR_CODE.PROTOCOL,
        message: 'targetRef must be a string',
        id,
      })
    }

    return {
      ok: true,
      frame: {
        v,
        id,
        op,
        msg: frame.msg,
        targetRef: frame.targetRef,
      },
    }
  }

  if (op === OPCODE.RESPONSE) {
    if (typeof frame.ok !== 'boolean') {
      return fail({
        code: ERROR_CODE.PROTOCOL,
        message: 'response ok flag required',
        id,
      })
    }

    if (frame.ok) {
      return {
        ok: true,
        frame: {
          v,
          id,
          op,
          ok: true,
          result: frame.result,
        },
      }
    }

    const err = frame.error
    if (err === null || typeof err !== 'object' || Array.isArray(err)) {
      return fail({
        code: ERROR_CODE.PROTOCOL,
        message: 'response error object required',
        id,
      })
    }

    if (typeof err.code !== 'string' || typeof err.message !== 'string') {
      return fail({
        code: ERROR_CODE.PROTOCOL,
        message: 'response error shape invalid',
        id,
      })
    }

    return {
      ok: true,
      frame: {
        v,
        id,
        op,
        ok: false,
        error: {
          code: err.code,
          message: err.message,
        },
      },
    }
  }

  return fail({
    code: ERROR_CODE.PROTOCOL,
    message: `unknown opcode: ${String(op)}`,
    id,
  })
}
