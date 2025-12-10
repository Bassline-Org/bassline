/**
 * Dashboard and Activity Buffer upgrade module.
 *
 * Provides:
 * - GET /dashboard - Returns dashboard type for UI rendering
 * - GET /activity - Returns recent activity events
 *
 * @param {import('@bassline/core').Bassline} bl
 */
export default function installDashboard(bl) {
  // Activity buffer - stores recent changes
  const activityBuffer = []
  const MAX_ACTIVITY = 100

  // Dashboard route - returns type for UI dispatch
  bl.route('/dashboard', {
    get: () => ({
      headers: { type: 'bl:///types/dashboard' },
      body: {
        title: 'System Dashboard',
        description: 'High-density view of cells, propagators, and activity'
      }
    })
  })

  // Activity buffer route
  bl.route('/activity', {
    get: () => ({
      headers: { type: 'bl:///types/activity-buffer' },
      body: {
        entries: activityBuffer.slice().reverse(),
        count: activityBuffer.length,
        maxSize: MAX_ACTIVITY
      }
    })
  })

  // Record activity when plumber is available
  function recordActivity(event) {
    const { uri, method, time } = event
    if (!uri) return

    // Skip activity and plumb routes to avoid noise
    if (uri.includes('/activity') || uri.includes('/plumb')) return

    activityBuffer.push({
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      uri,
      method: method || 'put',
      time: time || new Date().toISOString(),
      delta: event.delta || null
    })

    // Trim to max size
    while (activityBuffer.length > MAX_ACTIVITY) {
      activityBuffer.shift()
    }
  }

  // Register with plumber if available
  if (bl._plumber) {
    // Add a rule to route PUT events to our activity port
    bl._plumber.addRule('activity-tracker', {
      match: { method: 'put' },
      port: 'activity'
    })

    // Listen on the activity port
    bl._plumber.listen('activity', (msg) => {
      recordActivity({
        uri: msg.uri,
        method: 'put',
        time: new Date().toISOString()
      })
    })
  }

  // Expose activity recorder for manual use
  bl._activity = {
    record: recordActivity,
    getRecent: (n = 20) => activityBuffer.slice(-n).reverse(),
    clear: () => { activityBuffer.length = 0 }
  }

  console.log('Dashboard and Activity buffer installed')
}
