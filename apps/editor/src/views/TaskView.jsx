import { resourceClasses } from './index.jsx'
import Badge from '../components/Badge.jsx'
import LinkedResource from '../components/LinkedResource.jsx'

export default function TaskView({ resource, uri, onNavigate }) {
  const { title, status, assignee, parent } = resource.body || {}

  const statusVariant = status ? `status-${status.replace(/\s+/g, '-')}` : ''

  return (
    <div className={`view-card task-view ${resourceClasses(resource)}`}>
      <header className="task-header">
        {status && <Badge variant={statusVariant}>{status}</Badge>}
        <h1 className="task-title">{title || 'Untitled Task'}</h1>
      </header>

      <div className="uri">{uri}</div>

      {(assignee || parent) && (
        <dl className="task-details">
          {assignee && (
            <>
              <dt>Assignee</dt>
              <dd>
                <LinkedResource uri={assignee} onNavigate={onNavigate} />
              </dd>
            </>
          )}
          {parent && (
            <>
              <dt>Parent</dt>
              <dd>
                <LinkedResource uri={parent} onNavigate={onNavigate} />
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  )
}
