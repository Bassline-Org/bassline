import { useState, useEffect } from 'react'
import { useResource } from '@bassline/react'
import { ViewResolver, hasPrettyView } from './views/index.jsx'
import Breadcrumbs from './components/Breadcrumbs.jsx'
import ViewToggle from './components/ViewToggle.jsx'

function AddressBar({ value, onChange }) {
  const [input, setInput] = useState(value)

  // Sync input with external value changes
  useEffect(() => {
    setInput(value)
  }, [value])

  const handleSubmit = (e) => {
    e.preventDefault()
    onChange(input)
  }

  return (
    <form onSubmit={handleSubmit} className="address-bar">
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="bl:///local/data"
      />
    </form>
  )
}

export default function App() {
  const [uri, setUri] = useState('bl:///local')
  const [history, setHistory] = useState(['bl:///local'])
  const [viewMode, setViewMode] = useState('pretty')
  const { data, loading, error } = useResource(uri)

  const navigate = (newUri) => {
    setHistory(h => [...h, newUri])
    setUri(newUri)
  }

  const goBack = () => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1)
      setHistory(newHistory)
      setUri(newHistory[newHistory.length - 1])
    }
  }

  return (
    <div className="app">
      <header className="toolbar">
        <button onClick={goBack} disabled={history.length <= 1}>
          &larr;
        </button>
        <Breadcrumbs uri={uri} onNavigate={navigate} />
        <AddressBar value={uri} onChange={navigate} />
        {data && hasPrettyView(data) && (
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        )}
      </header>
      <main>
        {loading && <div className="loading">Loading...</div>}
        {error && <div className="error">Error: {error.message}</div>}
        {data && <ViewResolver resource={data} uri={uri} onNavigate={navigate} viewMode={viewMode} />}
        {!loading && !error && !data && <div className="empty">No data</div>}
      </main>
    </div>
  )
}
