import { useResource } from '@bassline/react'

const TYPE_ICONS = {
  'cell': '',
  'note': '',
  'task': '',
  'person': '',
  'type': '',
  'directory': ''
}

export default function LinkedResource({ uri, onNavigate }) {
  const { data, loading } = useResource(uri)

  if (loading) {
    return <span className="link-preview loading">...</span>
  }

  // Extract display info from the resource
  const body = data?.body || {}
  const name = body.name || body.title || body.label || uri.split('/').pop()
  const type = data?.headers?.type?.replace(/^bl:\/\/\/.*\/types\//, '') || 'unknown'
  const avatar = body.avatar

  return (
    <a
      href="#"
      className={`link-preview type-${type}`}
      onClick={e => { e.preventDefault(); onNavigate(uri) }}
    >
      {avatar && <span>{avatar}</span>}
      {!avatar && TYPE_ICONS[type] && <span>{TYPE_ICONS[type]}</span>}
      {name}
    </a>
  )
}
