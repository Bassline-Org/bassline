const PORT = process.env.BL_PORT || 9111
const BASE = `http://localhost:${PORT}`

export async function get(uri) {
  const res = await fetch(`${BASE}?uri=${encodeURIComponent(uri)}`)
  if (!res.ok) {
    console.error('Not found:', uri)
    process.exit(1)
  }
  console.log(JSON.stringify(await res.json(), null, 2))
}

export async function put(uri, json) {
  const res = await fetch(`${BASE}?uri=${encodeURIComponent(uri)}`, {
    method: 'PUT',
    body: json
  })
  if (!res.ok) {
    console.error('Error:', await res.text())
    process.exit(1)
  }
  console.log('Saved:', uri)
}
