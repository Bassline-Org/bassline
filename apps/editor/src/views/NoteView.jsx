import { resourceClasses } from './index.jsx'
import Badge from '../components/Badge.jsx'
import LinkedResource from '../components/LinkedResource.jsx'

export default function NoteView({ resource, uri, onNavigate }) {
  const { title, content, tags, links } = resource.body || {}

  return (
    <div className={`view-card note-view ${resourceClasses(resource)}`}>
      <h1>{title || 'Untitled Note'}</h1>
      <div className="uri">{uri}</div>

      {tags?.length > 0 && (
        <div className="note-tags">
          {tags.map(tag => (
            <Badge key={tag} variant="tag-badge">{tag}</Badge>
          ))}
        </div>
      )}

      {content && (
        <div className="note-content">{content}</div>
      )}

      {links?.length > 0 && (
        <div className="note-links">
          <h3>Links</h3>
          <ul>
            {links.map(link => (
              <li key={link}>
                <LinkedResource uri={link} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
