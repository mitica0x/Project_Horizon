import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ANTHROPIC_KEY } from '../config'

const DEFAULT_PILLS = [
  'Where are our biggest gaps this week?',
  'Which site should we target first?',
  'Who is blocking us on T1 sites?',
]

const SYSTEM = `You are Intel, an AI analyst embedded in Project Horizon — a competitive intelligence system monitoring Bybit's EU market presence across 53 fintech comparison sites. You help Ionut Vilceanu (Bybit Lead Marketing Europe) identify gaps, threats, and outreach opportunities. Be direct, concise, and actionable. No filler. Intelligence-grade tone.`

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 13V3M3 8l5-5 5 5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SuggestionPill({ label, onClick, compact = false }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background:   hover ? 'rgba(0,212,232,0.08)' : 'rgba(255,255,255,0.04)',
        border:       `1px solid ${hover ? 'rgba(0,212,232,0.2)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 20,
        padding:      compact ? '5px 10px' : '8px 16px',
        fontFamily:   "'IBM Plex Sans', sans-serif",
        fontSize:     compact ? 11 : 13,
        color:        hover ? '#ffffff' : '#8892a4',
        cursor:       'pointer',
        whiteSpace:   'nowrap',
        transition:   'background 0.2s, border-color 0.2s, color 0.2s',
      }}
    >
      {label}
    </button>
  )
}

function LoadingDots() {
  return (
    <div style={{
      alignSelf:    'flex-start',
      maxWidth:     '95%',
      background:   'rgba(255,255,255,0.03)',
      border:       '1px solid rgba(255,255,255,0.06)',
      borderRadius: '8px 8px 8px 2px',
      padding:      '12px 14px',
      display:      'inline-flex',
      gap:          6,
      alignItems:   'center',
    }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width:        6,
          height:       6,
          borderRadius: '50%',
          background:   '#c8d0dc',
          animation:    `intelDot 1.4s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  )
}

const AskTheBrief = forwardRef(function AskTheBrief({ suggestionPills }, ref) {
  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const threadRef    = useRef(null)
  const textareaRef  = useRef(null)

  const pills = suggestionPills && suggestionPills.length ? suggestionPills : DEFAULT_PILLS

  // Auto-scroll thread to bottom whenever messages or loading changes
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages, loading])

  // Textarea auto-grow up to 120px
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [input])

  const handleSend = async (overrideText) => {
    const text = (overrideText ?? input).trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':                              'application/json',
          'x-api-key':                                 ANTHROPIC_KEY,
          'anthropic-version':                         '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-6',
          max_tokens: 1024,
          system:     SYSTEM,
          messages:   newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data  = await response.json()
      const reply = data.content?.[0]?.text || 'No response received.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: 'Intel offline. Check API key in config.js.',
      }])
    } finally {
      setLoading(false)
    }
  }

  useImperativeHandle(ref, () => ({
    openWithQuestion: (question) => {
      setOpen(true)
      setInput(question)
      handleSend(question)
    },
  }))

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position:    'fixed',
            bottom:      80,
            right:       24,
            zIndex:      50,
            fontFamily:  "'IBM Plex Mono', monospace",
            fontSize:    13,
            color:       '#B8FF00',
            background:  '#131929',
            border:      '1px solid rgba(184,255,0,0.3)',
            borderRadius: 8,
            padding:     '12px 20px',
            cursor:      'pointer',
            transition:  'box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 16px rgba(184,255,0,0.25)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
        >
          ⬡ Intel
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="intel-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              style={{
                position: 'fixed',
                inset:    0,
                background: 'rgba(0,0,0,0.45)',
                zIndex:   99,
              }}
            />
            <motion.aside
              key="intel-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              style={{
                position:      'fixed',
                top:           0,
                right:         0,
                width:         500,
                height:        '100vh',
                background:    '#131929',
                borderLeft:    '1px solid rgba(184,255,0,0.15)',
                zIndex:        100,
                display:       'flex',
                flexDirection: 'column',
              }}
            >
              {/* HEADER */}
              <div style={{
                flexShrink:     0,
                padding:        '18px 20px',
                borderBottom:   '1px solid rgba(184,255,0,0.1)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
              }}>
                <div style={{
                  fontFamily:     "'Syne', sans-serif",
                  fontWeight:     700,
                  fontSize:       14,
                  letterSpacing:  '0.1em',
                  color:          '#B8FF00',
                  textTransform:  'uppercase',
                }}>
                  ⬡ Intel
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {messages.length > 0 && (
                    <button
                      onClick={() => setMessages([])}
                      style={{
                        background:  'none',
                        border:      'none',
                        fontFamily:  "'IBM Plex Sans', sans-serif",
                        fontSize:    11,
                        color:       '#8892a4',
                        cursor:      'pointer',
                        padding:     0,
                        transition:  'color 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#ffffff' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#8892a4' }}
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    style={{
                      background: 'none',
                      border:     'none',
                      color:      '#8892a4',
                      fontSize:   20,
                      cursor:     'pointer',
                      lineHeight: 1,
                      padding:    '0 2px',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ffffff' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#8892a4' }}
                  >×</button>
                </div>
              </div>

              {/* CONVERSATION THREAD */}
              <div ref={threadRef} style={{
                flex:           1,
                overflowY:      'auto',
                padding:        '16px 20px',
                display:        'flex',
                flexDirection:  'column',
                gap:            10,
                scrollbarWidth: 'thin',
              }}>
                {messages.length === 0 && !loading && (
                  <div style={{
                    alignSelf:  'flex-start',
                    paddingTop: 4,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize:   12,
                    color:      '#4a5568',
                  }}>
                    Intel is standing by.
                  </div>
                )}

                {messages.map((m, i) => (
                  <div
                    key={i}
                    style={
                      m.role === 'user'
                        ? {
                            alignSelf:    'flex-end',
                            maxWidth:     '85%',
                            background:   'rgba(0, 212, 232, 0.08)',
                            border:       '1px solid rgba(0, 212, 232, 0.15)',
                            borderRadius: '8px 8px 2px 8px',
                            padding:      '10px 14px',
                            fontFamily:   "'IBM Plex Sans', sans-serif",
                            fontSize:     14,
                            color:        '#ffffff',
                          }
                        : {
                            alignSelf:    'flex-start',
                            maxWidth:     '95%',
                            background:   'rgba(255,255,255,0.03)',
                            border:       '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '8px 8px 8px 2px',
                            padding:      '10px 14px',
                            fontFamily:   "'IBM Plex Sans', sans-serif",
                            fontSize:     14,
                            lineHeight:   1.7,
                            color:        '#c8d0dc',
                            whiteSpace:   'pre-wrap',
                          }
                    }
                  >
                    {m.content}
                  </div>
                ))}

                {loading && <LoadingDots />}
              </div>

              {/* INPUT BAR */}
              <div style={{
                flexShrink:    0,
                borderTop:     '1px solid rgba(255,255,255,0.06)',
                padding:       '12px 16px',
                display:       'flex',
                flexDirection: 'column',
                background:    '#0f1623',
              }}>
                {/* Suggestion chips — only when no messages yet */}
                {messages.length === 0 && (
                  <div style={{
                    display:       'flex',
                    flexWrap:      'wrap',
                    gap:           8,
                    paddingBottom: 8,
                  }}>
                    {pills.map((p, i) => (
                      <SuggestionPill
                        key={i}
                        label={p}
                        onClick={() => handleSend(p)}
                        compact
                      />
                    ))}
                  </div>
                )}

                {/* textarea + send */}
                <div style={{
                  display:    'flex',
                  gap:        10,
                  alignItems: 'flex-end',
                }}>
                  <textarea
                    ref={textareaRef}
                    className="intel-input"
                    rows={1}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Intel anything..."
                    style={{
                      flex:        1,
                      background:  'rgba(255,255,255,0.04)',
                      border:      '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8,
                      padding:     '10px 14px',
                      fontFamily:  "'IBM Plex Sans', sans-serif",
                      fontSize:    14,
                      color:       '#ffffff',
                      resize:      'none',
                      outline:     'none',
                      maxHeight:   120,
                      lineHeight:  1.5,
                      transition:  'border-color 0.15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,212,232,0.3)' }}
                    onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || loading}
                    style={{
                      width:           36,
                      height:          36,
                      borderRadius:    8,
                      background:      '#00d4e8',
                      border:          'none',
                      cursor:          !input.trim() || loading ? 'not-allowed' : 'pointer',
                      opacity:         !input.trim() || loading ? 0.3 : 1,
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                      flexShrink:      0,
                      transition:      'opacity 0.15s',
                    }}
                  >
                    <SendIcon />
                  </button>
                </div>
              </div>

              <style>{`
                @keyframes intelDot {
                  0%, 80%, 100% { opacity: 0.3; }
                  40%           { opacity: 1;   }
                }
                .intel-input::placeholder { color: #4a5568; }
              `}</style>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
})

export default AskTheBrief
