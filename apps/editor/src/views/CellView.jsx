import { resourceClasses } from './index.jsx'

export default function CellView({ resource, uri }) {
  const { label, value } = resource.body || {}

  const getValueClass = () => {
    if (typeof value === 'boolean') return `value-boolean ${value ? 'true' : 'false'}`
    if (typeof value === 'string') return 'value-string'
    return ''
  }

  const formatValue = () => {
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (value === null || value === undefined) return 'null'
    return String(value)
  }

  return (
    <div className={`view-card cell-view ${resourceClasses(resource)}`}>
      <div className="uri">{uri}</div>
      {label && <div className="cell-label">{label}</div>}
      <div className={`cell-value ${getValueClass()}`}>
        {formatValue()}
      </div>
    </div>
  )
}
