import { useState, useEffect, useRef, useCallback } from 'react'
import { useBassline, useHotkey } from '@bassline/react'
import { IconSearch, IconCircle, IconArrowRight, IconFolder, IconFile, IconDatabase, IconLayoutGrid, IconNetwork, IconTable } from '@tabler/icons-react'
import { REMOTE_PREFIX } from '../config.js'

/**
 * Command Palette - Quick navigation with Cmd+K
 */
export default function CommandPalette({ isOpen, onClose, onNavigate }) {
  const bl = useBassline()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      loadDefaultResults()
    }
  }, [isOpen])

  // Load default results (recent + common locations)
  const loadDefaultResults = async () => {
    const defaults = [
      { uri: `${REMOTE_PREFIX}/dashboard`, label: 'Dashboard', icon: 'dashboard', type: 'view' },
      { uri: 'bl:///network', label: 'Network Graph', icon: 'network', type: 'view' },
      { uri: 'bl:///explore/cells', label: 'Cell Explorer', icon: 'explore', type: 'view' },
      { uri: 'bl:///explore/propagators', label: 'Propagator Explorer', icon: 'explore', type: 'view' },
      { uri: `${REMOTE_PREFIX}/cells`, label: 'All Cells', icon: 'cell', type: 'directory' },
      { uri: `${REMOTE_PREFIX}/propagators`, label: 'All Propagators', icon: 'propagator', type: 'directory' },
      { uri: `${REMOTE_PREFIX}/data`, label: 'Data Store', icon: 'data', type: 'directory' },
      { uri: `${REMOTE_PREFIX}/types`, label: 'Type Definitions', icon: 'type', type: 'directory' },
      { uri: `${REMOTE_PREFIX}/links`, label: 'Link Index', icon: 'link', type: 'directory' },
      { uri: `${REMOTE_PREFIX}/install`, label: 'Installed Modules', icon: 'module', type: 'directory' },
      { uri: `${REMOTE_PREFIX}/activity`, label: 'Recent Activity', icon: 'activity', type: 'view' }
    ]
    setResults(defaults)
  }

  // Search as user types
  useEffect(() => {
    if (!query.trim()) {
      loadDefaultResults()
      return
    }

    const searchTimeout = setTimeout(async () => {
      setLoading(true)
      try {
        const searchResults = []

        // Search cells via remote daemon
        try {
          const cellsRes = await bl.get(`${REMOTE_PREFIX}/cells`)
          if (cellsRes?.body?.entries) {
            cellsRes.body.entries
              .filter(c => {
                const name = c.label || c.name || c.uri || ''
                return name.toLowerCase().includes(query.toLowerCase())
              })
              .slice(0, 5)
              .forEach(c => {
                searchResults.push({
                  uri: c.uri || `${REMOTE_PREFIX}/cells/${c.name}`,
                  label: c.label || c.name,
                  icon: 'cell',
                  type: 'cell',
                  value: c.value
                })
              })
          }
        } catch {}

        // Search propagators via remote daemon
        try {
          const propsRes = await bl.get(`${REMOTE_PREFIX}/propagators`)
          if (propsRes?.body?.entries) {
            propsRes.body.entries
              .filter(p => {
                const name = p.label || p.name || p.uri || ''
                return name.toLowerCase().includes(query.toLowerCase())
              })
              .slice(0, 5)
              .forEach(p => {
                searchResults.push({
                  uri: p.uri || `${REMOTE_PREFIX}/propagators/${p.name}`,
                  label: p.label || p.name,
                  icon: 'propagator',
                  type: 'propagator'
                })
              })
          }
        } catch {}

        // Search data store via remote daemon
        try {
          const dataRes = await bl.get(`${REMOTE_PREFIX}/data`)
          if (dataRes?.body?.entries) {
            dataRes.body.entries
              .filter(d => {
                const name = d.name || d.uri || ''
                return name.toLowerCase().includes(query.toLowerCase())
              })
              .slice(0, 5)
              .forEach(d => {
                searchResults.push({
                  uri: d.uri || `${REMOTE_PREFIX}/data/${d.name}`,
                  label: d.name,
                  icon: d.isDirectory ? 'folder' : 'file',
                  type: d.isDirectory ? 'directory' : 'data'
                })
              })
          }
        } catch {}

        // Allow direct URI navigation
        if (query.startsWith('bl:///') || query.startsWith('/')) {
          const uri = query.startsWith('/') ? `bl://${query}` : query
          searchResults.unshift({
            uri,
            label: `Go to: ${uri}`,
            icon: 'navigate',
            type: 'direct'
          })
        }

        setResults(searchResults)
        setSelectedIndex(0)
      } finally {
        setLoading(false)
      }
    }, 150)

    return () => clearTimeout(searchTimeout)
  }, [query, bl])

  // Keyboard navigation
  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results[selectedIndex]) {
          onNavigate(results[selectedIndex].uri)
          onClose()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }

  // Get icon for result type
  const getIcon = (item) => {
    switch (item.icon) {
      case 'cell':
        return <IconCircle size={16} style={{ color: 'var(--type-cell)' }} />
      case 'propagator':
        return <IconArrowRight size={16} style={{ color: 'var(--type-propagator)' }} />
      case 'folder':
      case 'directory':
        return <IconFolder size={16} style={{ color: 'var(--type-directory)' }} />
      case 'file':
      case 'data':
        return <IconFile size={16} style={{ color: 'var(--type-data)' }} />
      case 'dashboard':
        return <IconLayoutGrid size={16} style={{ color: 'var(--type-view)' }} />
      case 'network':
        return <IconNetwork size={16} style={{ color: 'var(--type-propagator)' }} />
      case 'explore':
        return <IconTable size={16} style={{ color: 'var(--accent)' }} />
      case 'activity':
      case 'view':
        return <IconDatabase size={16} style={{ color: 'var(--type-view)' }} />
      default:
        return <IconSearch size={16} />
    }
  }

  if (!isOpen) return null

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        <div className="command-palette-input">
          <IconSearch size={18} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search cells, propagators, data..."
          />
          <kbd>esc</kbd>
        </div>
        <div className="command-palette-results">
          {loading && <div className="command-palette-loading">Searching...</div>}
          {!loading && results.length === 0 && (
            <div className="command-palette-empty">No results found</div>
          )}
          {!loading && results.map((item, i) => (
            <div
              key={item.uri}
              className={`command-palette-item ${i === selectedIndex ? 'selected' : ''}`}
              onClick={() => {
                onNavigate(item.uri)
                onClose()
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="command-palette-icon">{getIcon(item)}</span>
              <span className="command-palette-label">{item.label}</span>
              <span className="command-palette-type">{item.type}</span>
              {item.value !== undefined && (
                <span className="command-palette-value">{String(item.value)}</span>
              )}
            </div>
          ))}
        </div>
        <div className="command-palette-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
