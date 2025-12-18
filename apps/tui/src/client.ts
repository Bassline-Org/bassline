/**
 * HTTP client for Bassline daemon
 */

export interface BasslineResponse {
  headers: Record<string, unknown>
  body: Record<string, unknown>
}

/**
 * Evaluate Tcl script in a session.
 * Sessions persist variables and proc definitions across evals.
 * @param baseUrl - Daemon URL
 * @param script - Tcl script to evaluate
 * @param sessionId - Session ID (defaults to 'default')
 */
export async function evalTcl(baseUrl: string, script: string, sessionId = 'default'): Promise<BasslineResponse> {
  const uri = `bl:///tcl/${sessionId}/eval`
  const res = await fetch(`${baseUrl}?uri=${encodeURIComponent(uri)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script }),
  })
  return res.json()
}

/**
 * List all Tcl sessions
 */
export async function listSessions(baseUrl: string): Promise<BasslineResponse> {
  const res = await fetch(`${baseUrl}?uri=${encodeURIComponent('bl:///tcl')}`)
  return res.json()
}

/**
 * Delete a Tcl session
 */
export async function deleteSession(baseUrl: string, sessionId: string): Promise<BasslineResponse> {
  const res = await fetch(`${baseUrl}?uri=${encodeURIComponent(`bl:///tcl/${sessionId}/delete`)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return res.json()
}

export async function get(baseUrl, uri) {
  const res = await fetch(`${baseUrl}?uri=${encodeURIComponent(uri)}`)
  return res.json()
}

export async function probe(baseUrl) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 500)
    const res = await fetch(`${baseUrl}?uri=bl:///`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return res.ok
  } catch {
    return false
  }
}

export async function findDaemons(ports = [9111, 9112, 9113, 9114, 9115]) {
  const results = await Promise.all(
    ports.map(async port => {
      const url = `http://localhost:${port}`
      const alive = await probe(url)
      return alive ? { port, url } : null
    })
  )
  return results.filter(Boolean)
}
