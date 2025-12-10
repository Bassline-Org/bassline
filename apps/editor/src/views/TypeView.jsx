import { resourceClasses } from './index.jsx'

export default function TypeView({ resource, uri }) {
  const { name, description, schema } = resource.body || {}

  return (
    <div className={`view-card type-view ${resourceClasses(resource)}`}>
      <h1>{name || 'Unnamed Type'}</h1>
      <div className="uri">{uri}</div>

      {description && (
        <p className="type-description">{description}</p>
      )}

      {schema && Object.keys(schema).length > 0 && (
        <section className="type-schema">
          <h3>Schema</h3>
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Required</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(schema).map(([field, def]) => (
                <tr key={field}>
                  <td>{field}</td>
                  <td>{def.type || 'any'}</td>
                  <td>{def.required ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
