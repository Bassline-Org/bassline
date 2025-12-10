import { resourceClasses } from './index.jsx'
import Badge from '../components/Badge.jsx'
import TypeIcon from '../components/TypeIcon.jsx'

export default function Directory({ resource, uri, onNavigate }) {
  const entries = resource.body?.entries || []

  return (
    <div className={`directory-view ${resourceClasses(resource)}`}>
      <header className="directory-header">
        <h2>{uri}</h2>
        <span className="entry-count">{entries.length} items</span>
      </header>

      {entries.length === 0 ? (
        <div className="empty">Empty directory</div>
      ) : (
        <ul className="entries">
          {entries.map(entry => (
            <li key={entry.name} className={`entry type-${entry.type || 'unknown'}`}>
              <span className="entry-icon">
                <TypeIcon type={entry.type || 'unknown'} size={16} />
              </span>
              <a href="#" onClick={e => {
                e.preventDefault()
                onNavigate(entry.uri)
              }}>
                {entry.name}
              </a>
              {entry.type && entry.type !== 'directory' && (
                <Badge variant="type-badge">{entry.type}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
