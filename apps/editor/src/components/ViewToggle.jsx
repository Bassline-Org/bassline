export default function ViewToggle({ mode, onChange }) {
  return (
    <div className="view-toggle">
      <button
        className={mode === 'pretty' ? 'active' : ''}
        onClick={() => onChange('pretty')}
        title="Pretty view"
      >
        Pretty
      </button>
      <button
        className={mode === 'raw' ? 'active' : ''}
        onClick={() => onChange('raw')}
        title="Raw JSON"
      >
        Raw
      </button>
    </div>
  )
}
