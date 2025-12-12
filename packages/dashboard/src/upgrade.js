/**
 * Dashboard and Activity Buffer upgrade module.
 *
 * Provides:
 * - GET /dashboard - Returns dashboard type for UI rendering
 * - GET /activity - Returns recent activity events
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
        description: 'High-density view of cells, propagators, and activity',
      },
    }),
  })

  // Activity buffer route
  bl.route('/activity', {
    get: () => ({
      headers: { type: 'bl:///types/activity-buffer' },
      body: {
        entries: activityBuffer.slice().reverse(),
        count: activityBuffer.length,
        maxSize: MAX_ACTIVITY,
      },
    }),
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
      delta: event.delta || null,
    })

    // Trim to max size
    while (activityBuffer.length > MAX_ACTIVITY) {
      activityBuffer.shift()
    }
  }

  // Activity tracking can be enabled by adding a plumber rule:
  //   PUT bl:///plumb/rules/activity { match: { type: '.*' }, to: 'bl:///dashboard/track' }
  // For now, activity is only recorded via manual bl._activity.record() calls.

  // Expose activity recorder for late binding
  const activity = {
    record: recordActivity,
    getRecent: (n = 20) => activityBuffer.slice(-n).reverse(),
    clear: () => {
      activityBuffer.length = 0
    },
  }
  bl.setModule('activity', activity)

  console.log('Dashboard and Activity buffer installed')
}
