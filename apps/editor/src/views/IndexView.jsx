import TypeIcon from '../components/TypeIcon.jsx'

export default function IndexView({ resource, onNavigate }) {
  const { name, description, subsystems } = resource.body

  return (
    <div className="index-view">
      <h1>{name}</h1>
      {description && <p className="description">{description}</p>}

      <section>
        <h2>Subsystems</h2>
        <ul className="subsystems-list">
          {subsystems?.map(sub => (
            <li key={sub.name}>
              <a
                href="#"
                className="link-preview"
                onClick={e => { e.preventDefault(); onNavigate(sub.uri) }}
              >
                <TypeIcon type={sub.name} size={18} />
                <span>{sub.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
