import { resourceClasses } from './index.jsx'

// Render JSON with clickable URIs
function JsonTree({ data, onClickUri, depth = 0 }) {
  if (data === null) return <span className="null">null</span>
  if (data === undefined) return <span className="undefined">undefined</span>

  if (typeof data === 'string') {
    // Check if it's a URI
    if (data.startsWith('bl:///')) {
      return (
        <a href="#" onClick={e => { e.preventDefault(); onClickUri(data) }}>
          "{data}"
        </a>
      )
    }
    return <span className="string">"{data}"</span>
  }

  if (typeof data === 'number') return <span className="number">{data}</span>
  if (typeof data === 'boolean') return <span className="boolean">{data.toString()}</span>

  if (Array.isArray(data)) {
    if (data.length === 0) return <span>[]</span>
    return (
      <span>
        {'[\n'}
        {data.map((item, i) => (
          <span key={i}>
            {'  '.repeat(depth + 1)}
            <JsonTree data={item} onClickUri={onClickUri} depth={depth + 1} />
            {i < data.length - 1 ? ',\n' : '\n'}
          </span>
        ))}
        {'  '.repeat(depth)}]
      </span>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data)
    if (entries.length === 0) return <span>{'{}'}</span>
    return (
      <span>
        {'{\n'}
        {entries.map(([key, value], i) => (
          <span key={key}>
            {'  '.repeat(depth + 1)}
            <span className="key">"{key}"</span>: <JsonTree data={value} onClickUri={onClickUri} depth={depth + 1} />
            {i < entries.length - 1 ? ',\n' : '\n'}
          </span>
        ))}
        {'  '.repeat(depth)}{'}'}
      </span>
    )
  }

  return <span>{String(data)}</span>
}

export default function Inspector({ resource, uri, onNavigate }) {
  return (
    <div className={resourceClasses(resource)}>
      <h2>{uri}</h2>
      <section>
        <h3>Headers</h3>
        <pre><JsonTree data={resource.headers} onClickUri={onNavigate} /></pre>
      </section>
      <section>
        <h3>Body</h3>
        <pre><JsonTree data={resource.body} onClickUri={onNavigate} /></pre>
      </section>
    </div>
  )
}
