import { resourceClasses } from './index.jsx'

export default function PersonView({ resource, uri }) {
  const { name, email, role, avatar } = resource.body || {}

  return (
    <div className={`view-card person-view ${resourceClasses(resource)}`}>
      <div className="person-avatar">{avatar || ''}</div>
      <div className="person-info">
        <h1 className="person-name">{name || 'Unknown'}</h1>
        {role && <div className="person-role">{role}</div>}
        {email && (
          <a href={`mailto:${email}`} className="person-email">
            {email}
          </a>
        )}
        <div className="uri">{uri}</div>
      </div>
    </div>
  )
}
