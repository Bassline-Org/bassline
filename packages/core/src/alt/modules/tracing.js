export default function tracing(platform) {
  const write = (event, data) => {
    process.stdout.write(JSON.stringify({ ts: Date.now(), event, ...data }) + '\n')
  }

  platform.on('resource.mounted', d => write('mounted', { name: d.name }))
  platform.on('resource.unmounted', d => write('unmounted', { name: d.name }))
  platform.on('server.started', d => write('server.started', d))
  platform.on('server.stopping', d => write('server.stopping', d))
}
