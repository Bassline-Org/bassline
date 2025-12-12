export default function Breadcrumbs({ uri, onNavigate }) {
  // Parse bl:///local/data/foo/bar into parts
  const path = uri.replace('bl:///', '')
  const parts = path.split('/').filter(Boolean)

  return (
    <nav className="breadcrumbs">
      {parts.map((part, i) => {
        const href = 'bl:///' + parts.slice(0, i + 1).join('/')
        const isLast = i === parts.length - 1

        return (
          <span key={i}>
            {i > 0 && <span className="separator">/</span>}
            {isLast ? (
              <span className="current">{part}</span>
            ) : (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  onNavigate(href)
                }}
              >
                {part}
              </a>
            )}
          </span>
        )
      })}
    </nav>
  )
}
