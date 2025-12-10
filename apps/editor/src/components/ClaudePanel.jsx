import { useState, useRef, useEffect, useCallback } from 'react'
import { useBassline } from '@bassline/react'
import { IconX, IconSend, IconRobot, IconTool, IconLoader2, IconToggleLeft, IconToggleRight } from '@tabler/icons-react'
import { REMOTE_PREFIX } from '../config.js'

/**
 * Format tool call for display
 */
function formatToolCall(toolUse) {
  const name = toolUse.name || 'unknown'
  const input = toolUse.input || {}
  return {
    name,
    summary: Object.entries(input)
      .slice(0, 2)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v.slice(0, 30) : JSON.stringify(v).slice(0, 30)}`)
      .join(', ')
  }
}

/**
 * Single message display
 */
function Message({ message, isStreaming }) {
  const { role, content } = message

  // Handle different content types
  const renderContent = () => {
    if (typeof content === 'string') {
      return <p className="message-text">{content}</p>
    }

    if (Array.isArray(content)) {
      return content.map((block, i) => {
        if (block.type === 'text') {
          return <p key={i} className="message-text">{block.text}</p>
        }
        if (block.type === 'tool_use') {
          const { name, summary } = formatToolCall(block)
          return (
            <div key={i} className="tool-call">
              <IconTool size={12} />
              <span className="tool-name">{name}</span>
              {summary && <span className="tool-args">{summary}</span>}
            </div>
          )
        }
        if (block.type === 'tool_result') {
          return (
            <div key={i} className="tool-result">
              <span className="tool-result-label">Result:</span>
              <code>{typeof block.content === 'string' ? block.content.slice(0, 100) : JSON.stringify(block.content).slice(0, 100)}</code>
            </div>
          )
        }
        return null
      })
    }

    return <p className="message-text">{JSON.stringify(content)}</p>
  }

  return (
    <div className={`claude-message ${role} ${isStreaming ? 'streaming' : ''}`}>
      <div className="message-role">
        {role === 'assistant' ? <IconRobot size={14} /> : null}
        <span>{role === 'user' ? 'You' : 'Claude'}</span>
      </div>
      <div className="message-content">
        {renderContent()}
      </div>
    </div>
  )
}

/**
 * ClaudePanel - Sliding panel for Claude interaction
 */
export default function ClaudePanel({ isOpen, onClose }) {
  const bl = useBassline()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [agentMode, setAgentMode] = useState(false)
  const [serviceAvailable, setServiceAvailable] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Check if Claude service is available
  useEffect(() => {
    if (isOpen && serviceAvailable === null) {
      bl.get(`${REMOTE_PREFIX}/services/claude`)
        .then(res => {
          setServiceAvailable(res?.body?.capabilities?.length > 0)
        })
        .catch(() => {
          setServiceAvailable(false)
        })
    }
  }, [isOpen, bl, serviceAvailable])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      // System prompt for Bassline context
      const system = `You are an AI assistant integrated with Bassline, a resource-based programming environment.
You can help users understand and interact with their data.

Key concepts:
- Cells: Reactive values with lattice merge semantics (maxNumber, minNumber, setUnion, lww)
- Propagators: Connect cells and compute derived values
- Resources: Everything is addressable via URIs like bl:///cells/counter

Be concise and helpful. When discussing resources, mention their URIs.`

      let response
      if (agentMode) {
        // Agent mode: Use agentic loop with tools
        response = await bl.put(`${REMOTE_PREFIX}/services/claude/agent`, {}, {
          prompt: input,
          system,
          maxTurns: 10
        })

        // Agent returns the final Claude response
        if (response?.body?.content) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: response.body.content
          }])
        }
      } else {
        // Chat mode: Regular messages API
        const apiMessages = [...messages, userMessage].map(m => ({
          role: m.role,
          content: m.content
        }))

        response = await bl.put(`${REMOTE_PREFIX}/services/claude/messages`, {}, {
          messages: apiMessages,
          system,
          max_tokens: 2048
        })

        if (response?.body?.content) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: response.body.content
          }])
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to get response')
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, bl, agentMode])

  const handleClear = () => {
    setMessages([])
    setError(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="claude-panel-overlay" onClick={onClose}>
      <div className="claude-panel" onClick={e => e.stopPropagation()}>
        <div className="claude-panel-header">
          <h2>
            <IconRobot size={20} style={{ marginRight: 8 }} />
            Claude Assistant
          </h2>
          <div className="claude-panel-controls">
            <button
              className={`agent-toggle ${agentMode ? 'active' : ''}`}
              onClick={() => setAgentMode(!agentMode)}
              title={agentMode ? 'Agent mode (tools enabled)' : 'Chat mode (no tools)'}
            >
              {agentMode ? <IconToggleRight size={16} /> : <IconToggleLeft size={16} />}
              <span>{agentMode ? 'Agent' : 'Chat'}</span>
            </button>
            <button className="claude-panel-close" onClick={onClose}>
              <IconX size={18} />
            </button>
          </div>
        </div>

        {serviceAvailable === false && (
          <div className="claude-service-unavailable">
            <p>Claude service is not available.</p>
            <p className="hint">Set ANTHROPIC_API_KEY environment variable and restart the daemon.</p>
          </div>
        )}

        {serviceAvailable !== false && (
          <>
            <div className="claude-messages">
              {messages.length === 0 && (
                <div className="claude-welcome">
                  <p>Ask me anything about your Bassline resources.</p>
                  <div className="claude-suggestions">
                    <button onClick={() => setInput('What cells exist in the system?')}>
                      What cells exist?
                    </button>
                    <button onClick={() => setInput('Explain how propagators work')}>
                      How do propagators work?
                    </button>
                    <button onClick={() => setInput('Help me create a reactive counter')}>
                      Create a counter
                    </button>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <Message
                  key={i}
                  message={msg}
                  isStreaming={loading && i === messages.length - 1 && msg.role === 'assistant'}
                />
              ))}

              {loading && messages[messages.length - 1]?.role === 'user' && (
                <div className="claude-message assistant streaming">
                  <div className="message-role">
                    <IconRobot size={14} />
                    <span>Claude</span>
                  </div>
                  <div className="message-content">
                    <IconLoader2 className="spinner" size={16} />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="claude-error">
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <form className="claude-input-form" onSubmit={handleSubmit}>
              {messages.length > 0 && (
                <button type="button" className="clear-btn" onClick={handleClear} title="Clear conversation">
                  Clear
                </button>
              )}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Claude..."
                disabled={loading || serviceAvailable === false}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading || serviceAvailable === false}
                title="Send message"
              >
                <IconSend size={16} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
