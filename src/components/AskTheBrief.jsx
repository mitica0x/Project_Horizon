import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

const DEFAULT_PILLS = [
  'Where are our biggest gaps this week?',
  'Which site should we target first?',
  'Who is blocking us on T1 sites?',
]

const SYSTEM = `You are Intel, an AI analyst embedded in Project Horizon — a competitive intelligence system monitoring Bybit's EU market presence across 25 fintech comparison sites. You help C0insiglieri Team (Bybit Lead Marketing Europe) identify gaps, threats, and outreach opportunities. Be direct, concise, and actionable. No filler. Intelligence-grade tone.`

const HORIZ0N_GUIDE = `
HORIZ0N PRODUCT GUIDE — use this when the user asks how to use the product, what
something means, or what they should do.

SECTIONS:
- SCAN: The core intelligence view. Shows EU Presence Score (% of tracked sites where
  Bybit appears), Market Map (who owns what by tier and geography), Gap Cards (sites where
  Bybit is absent and competitors are present), Competitor Momentum (how often each
  competitor appears across all tracked sites), BUILD PLAN (30-day action sequence),
  CMO BRIEF (executive summary), VS LAST SCAN (what changed since previous scan).
- STATUS: Daily action board. Shows recommended actions today based on current scan,
  recent changes in the field, and upcoming activation windows.
- WINDOWS: Timing intelligence. Shows when activation windows open based on editorial
  cycles, seasonal patterns, and competitor movement.
- OUTCOMES: Activation tracking. Log what you activated, when, and what happened.
  Builds the pattern database over time.
- LEDGER: Decision log. Record strategic decisions and their rationale. INTEL learns
  from these over time.
- SIGNAL: Verdict system. Gives MOVE/PREPARE/HOLD based on current field conditions.
  MOVE means activate now. PREPARE means get ready, window opening soon. HOLD means
  conditions unfavorable.
- BRIEF: Full intelligence brief. Narrative-first summary of the current situation.
  Toggle client-ready to generate a version safe to share externally.
- NETWORK: Contact intelligence. Maps known contacts to specific gap sites. Tracks
  outreach status per gap.
- TRACE: Source monitor. Tracks the URLs being monitored and their scan status.
- N0VA: AI war room. Deep strategic session mode for complex decisions.
- INTEL: This panel. Ask anything about the market or how to use Horiz0n.

KEY METRICS:
- EU Presence Score: % of tracked sites where Bybit appears. Higher = better field
  coverage. Currently calculated as (sites with Bybit) / (total sites tracked) × 100.
- OPP Score: Opportunity score per site (0-100). Higher = bigger gap to close. Driven
  by site tier, competitor density, and geographic priority.
- T1/T2/T3 Tiers: Site quality tiers. T1 = highest traffic/authority comparison sites
  (finder.com, investopedia, moneysavingexpert). T2 = mid-tier. T3 = niche/emerging.
- Bybit Present: Site where Bybit is already listed. Green in Market Map.
- Brand Alerts: Sites where brand-threat competitors (Revolut) appear and Bybit
  is absent. High priority gaps.
- Competitor Momentum: How many tracked sites each competitor appears on. Longer bar =
  wider presence = stronger competitor.

KEY ACTIONS:
- SCAN NOW: Triggers a fresh crawl of all 24 tracked sites. Updates all data. Use when
  you want latest data outside the daily automatic scan (runs 6am UTC daily).
- BUILD PLAN: Auto-generated 30-day outreach sequence based on current gaps, sorted by
  OPP score. Shows which sites to contact in what order.
- CMO BRIEF: One-click executive summary. Toggle client-ready to remove internal
  notes. Safe to send to Bybit leadership.
- VS LAST SCAN: Shows what changed since the previous scan — new gaps, closed gaps,
  competitor movements.
- Draft Outreach: On each gap card, generates a draft outreach email to the site's
  editorial team.
- SCAN → OUTCOMES flow: When you activate a gap (contact a site and get listed), log
  it in OUTCOMES. This builds your pattern database and improves WINDOWS predictions.

THE WORKFLOW:
1. Check SIGNAL — is it MOVE, PREPARE, or HOLD?
2. If MOVE — open SCAN, look at top OPP score gaps in your priority geo
3. Open BUILD PLAN — follow the 30-day sequence
4. Use Draft Outreach to contact sites
5. Log activations in OUTCOMES
6. Track decisions in LEDGER
7. Use BRIEF / CMO BRIEF for weekly reporting to leadership
`;

// Route product/how-to questions to the guide; market questions use scan context.
const isProductQuestion = (userMessage) => {
  const productKeywords = [
    'what is', 'what does', 'how do i', 'how to', 'what should',
    'explain', 'what means', 'opp score', 'eu presence', 'tier',
    'signal', 'windows', 'outcomes', 'ledger', 'brief', 'network',
    'trace', 'nova', 'n0va', 'scan now', 'build plan', 'cmo brief',
    'how does', 'what are', 'tell me about horiz0n', 'help', 'guide',
    'workflow', 'how should i', 'what do i do', 'getting started'
  ];
  const lower = (userMessage || '').toLowerCase();
  return productKeywords.some(kw => lower.includes(kw));
};

// Attachment support — one image or PDF per message.
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const ATTACH_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf'
const MAX_ATTACH_BYTES = 5 * 1024 * 1024

const fileToBase64 = (file) =>
  new Promise((res) => {
    const reader = new FileReader()
    reader.onload = () => res(reader.result.split(',')[1])
    reader.readAsDataURL(file)
  })

function PaperclipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke="currentColor"
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
        fontFamily:   "'Geist', sans-serif",
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
  const [sysContext, setSysContext] = useState(null)
  const [intelInsight, setIntelInsight] = useState(null)
  const [intelChips,   setIntelChips]   = useState(null)
  const [attachment,   setAttachment]   = useState(null) // { file, name, type, isImage, previewUrl }
  const [attachError,  setAttachError]  = useState(null)
  const [listening,    setListening]    = useState(false)
  const [interim,      setInterim]      = useState('')
  const [isStreaming,  setIsStreaming]  = useState(false)
  const threadRef    = useRef(null)
  const textareaRef  = useRef(null)
  const fileInputRef = useRef(null)
  const recognitionRef = useRef(null)
  const abortControllerRef = useRef(null)

  const clearAttachment = () => {
    setAttachment(prev => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
    setAttachError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onPickFile = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const ok =
      IMAGE_TYPES.includes(file.type) || file.type === 'application/pdf'
    if (!ok) {
      setAttachError('Unsupported file type')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > MAX_ATTACH_BYTES) {
      setAttachError('File too large (max 5MB)')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    const isImage = IMAGE_TYPES.includes(file.type)
    setAttachError(null)
    setAttachment({
      file,
      name: file.name,
      type: file.type,
      isImage,
      previewUrl: isImage ? URL.createObjectURL(file) : null,
    })
  }

  // Shared accept path for drag/drop + clipboard paste — same validation and
  // attachment state/preview chip as the file picker. `imageOnly` for paste.
  const acceptFile = (file, imageOnly = false) => {
    if (!file) return
    const isImage = IMAGE_TYPES.includes(file.type)
    const ok = imageOnly ? isImage : (isImage || file.type === 'application/pdf')
    if (!ok) {
      setAttachError(imageOnly ? 'Only images can be pasted' : 'Unsupported file type')
      return
    }
    if (file.size > MAX_ATTACH_BYTES) {
      setAttachError('File too large (max 5MB)')
      return
    }
    setAttachError(null)
    setAttachment({
      file,
      name: file.name || (isImage ? 'pasted-image.png' : 'pasted-file'),
      type: file.type,
      isImage,
      previewUrl: isImage ? URL.createObjectURL(file) : null,
    })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
    if (f) acceptFile(f, false)
  }

  const handlePaste = (e) => {
    const f =
      e.clipboardData && e.clipboardData.files && e.clipboardData.files[0]
    if (f) {
      e.preventDefault()
      acceptFile(f, true)
    }
    // No file in clipboard → let the default text paste proceed.
  }

  const startVoice = () => {
    if (listening) {
      try { recognitionRef.current && recognitionRef.current.stop() } catch { /* ignore */ }
      return
    }
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setAttachError('Voice not supported in this browser')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = '' // browser uses system language
    recognitionRef.current = recognition
    setAttachError(null)
    setInterim('')
    setListening(true)
    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) finalText += t
        else interimText += t
      }
      if (finalText) {
        setInput(finalText.trim())
        setInterim('')
        try { recognition.stop() } catch { /* ignore */ }
      } else {
        setInterim(interimText)
      }
    }
    recognition.onerror = () => {
      setListening(false)
      setInterim('')
    }
    recognition.onend = () => {
      setListening(false)
      setInterim('')
    }
    try { recognition.start() } catch { setListening(false) }
  }

  // Stop any active recognition if the component unmounts.
  useEffect(() => () => {
    try { recognitionRef.current && recognitionRef.current.stop() } catch { /* ignore */ }
  }, [])

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
    const att = attachment
    if ((!text && !att) || loading) return

    // Product/how-to questions get the Horiz0n guide appended; market questions
    // keep the existing market-intel system prompt only.
    const guideSection = isProductQuestion(text)
      ? `\n\nPRODUCT GUIDE:\n${HORIZ0N_GUIDE}`
      : ''

    // History + thread render stay string-content (unchanged). The attachment
    // is injected only into the outgoing API message construction.
    const displayText = text || `📎 ${att ? att.name : ''}`
    const userMsg = { role: 'user', content: displayText }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))
      if (att) {
        const base64 = await fileToBase64(att.file)
        const apiText = text || `Please review the attached ${att.isImage ? 'image' : 'document'}.`
        const block = att.isImage
          ? { type: 'image', source: { type: 'base64', media_type: att.type, data: base64 } }
          : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
        apiMessages[apiMessages.length - 1] = {
          role: 'user',
          content: [block, { type: 'text', text: apiText }],
        }
      }
      clearAttachment()

      const ctrl = new AbortController()
      abortControllerRef.current = ctrl
      setIsStreaming(true)

      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/intel/chat`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: apiMessages,
          system: (sysContext ? `${SYSTEM}\n\n${sysContext}` : SYSTEM) + guideSection,
        }),
      })

      const data  = await response.json()
      const reply = data.content?.[0]?.text || 'No response received.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      const aborted =
        (abortControllerRef.current && abortControllerRef.current.signal.aborted) ||
        (err && err.name === 'AbortError')
      // Stopped by the user — keep the thread as-is, no error bubble; any
      // partial response stays visible.
      if (!aborted) {
        setMessages(prev => [...prev, {
          role:    'assistant',
          content: 'Intel offline. Check API key in config.js.',
        }])
      }
    } finally {
      setLoading(false)
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }

  useImperativeHandle(ref, () => ({
    openWithQuestion: (question) => {
      setSysContext(null)
      setIntelInsight(null)
      setIntelChips(null)
      setOpen(true)
      setInput(question)
      handleSend(question)
    },
    // S8 — open the same chat primed with a section-specific system context.
    // Optional `intel` = { insight, chips } renders a pre-conversation read.
    openWithContext: (ctx, intel) => {
      setSysContext(ctx || null)
      setIntelInsight(intel?.insight || null)
      setIntelChips(intel?.chips || null)
      setOpen(true)
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
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop is visual only — INTEL is a conversation, so
                click-outside-to-close is intentionally disabled. Close via
                the header X. */}
            <motion.div
              key="intel-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
              onDrop={handleDrop}
              style={{
                position:      'fixed',
                top:           0,
                right:         0,
                width:         'min(600px, 100vw)',
                height:        '100vh',
                background:    '#131929',
                borderLeft:    '1px solid rgba(148,200,100,0.15)',
                zIndex:        300,
                display:       'flex',
                flexDirection: 'column',
              }}
            >
              <button
                onClick={() => setOpen(false)}
                aria-label="Close Intel"
                title="Close"
                style={{
                  position: 'fixed',
                  top: '16px',
                  right: '16px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 99999
                }}
              >×</button>

              {/* HEADER */}
              <div style={{
                position:       'relative',
                flexShrink:     0,
                padding:        '18px 20px',
                borderBottom:   '1px solid rgba(148,200,100,0.1)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
              }}>
                <div style={{
                  fontFamily:     "'Geist', sans-serif",
                  fontWeight:     700,
                  fontSize:       14,
                  letterSpacing:  '0.1em',
                  color:          '#94c864',
                  textTransform:  'uppercase',
                }}>
                  ⬡ Intel
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
                {messages.length === 0 && !loading && !intelInsight && (
                  <div style={{
                    alignSelf:  'flex-start',
                    paddingTop: 4,
                    fontFamily: "'Geist Mono', monospace",
                    fontSize:   12,
                    color:      '#8892a4',
                  }}>
                    What do you need? Type 'report' for a full briefing, or ask me anything about Bybit EU's market position.
                  </div>
                )}

                {messages.length === 0 && !loading && intelInsight && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 2 }}>
                    <div>
                      <div style={{
                        fontFamily:    "'Geist Mono', monospace",
                        fontSize:      10,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color:         '#94c864',
                        marginBottom:  7,
                      }}>
                        Intel reads →
                      </div>
                      <div style={{
                        fontFamily: "'Geist', sans-serif",
                        fontStyle:  'italic',
                        fontSize:   15,
                        lineHeight: 1.5,
                        color:      '#00d4e8',
                      }}>
                        {intelInsight}
                      </div>
                    </div>
                    {intelChips && intelChips.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {intelChips.map((c, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(c)}
                            style={{
                              background:    '#0f1623',
                              border:        '1px solid rgba(0,212,232,0.35)',
                              borderRadius:  6,
                              padding:       '7px 12px',
                              fontFamily:    "'Geist Mono', monospace",
                              fontSize:      11,
                              color:         '#00d4e8',
                              cursor:        'pointer',
                              textAlign:     'left',
                              transition:    'background 0.15s, border-color 0.15s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(0,212,232,0.08)'
                              e.currentTarget.style.borderColor = '#00d4e8'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = '#0f1623'
                              e.currentTarget.style.borderColor = 'rgba(0,212,232,0.35)'
                            }}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
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
                            fontFamily:   "'Geist', sans-serif",
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
                            fontFamily:   "'Geist', sans-serif",
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
                {/* Legacy default pills — suppressed when section chips present */}
                {messages.length === 0 && !intelChips && (
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

                {/* attachment preview chip */}
                {attachment && (
                  <div style={{
                    display:      'inline-flex',
                    alignItems:   'center',
                    gap:          8,
                    alignSelf:    'flex-start',
                    maxWidth:     '100%',
                    background:   'rgba(255,255,255,0.04)',
                    border:       '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding:      '6px 8px 6px 6px',
                    marginBottom: 8,
                  }}>
                    {attachment.isImage ? (
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.name}
                        style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                      />
                    ) : (
                      <span style={{
                        width: 28, height: 28, borderRadius: 4, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,212,232,0.12)', color: '#00d4e8',
                        fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 700,
                      }}>PDF</span>
                    )}
                    <span style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: 11,
                      color: '#c8d0dc',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 320,
                    }}>{attachment.name}</span>
                    <button
                      onClick={clearAttachment}
                      title="Remove attachment"
                      aria-label="Remove attachment"
                      style={{
                        background: 'none', border: 'none', color: '#8892a4',
                        fontSize: 14, lineHeight: 1, cursor: 'pointer', padding: '0 2px',
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#ffffff' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#8892a4' }}
                    >×</button>
                  </div>
                )}
                {attachError && (
                  <div style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 11,
                    color: '#ff4d6d',
                    marginBottom: 8,
                  }}>{attachError}</div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ATTACH_ACCEPT}
                  onChange={onPickFile}
                  style={{ display: 'none' }}
                />

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
                    onPaste={handlePaste}
                    placeholder={
                      listening
                        ? (interim || 'Listening…')
                        : 'Ask Intel anything...'
                    }
                    style={{
                      flex:        1,
                      background:  'rgba(255,255,255,0.04)',
                      border:      '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8,
                      padding:     '10px 14px',
                      fontFamily:  "'Geist', sans-serif",
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
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    disabled={loading || !!attachment}
                    title="Attach image or PDF (max 5MB)"
                    aria-label="Attach a file"
                    style={{
                      width:           36,
                      height:          36,
                      borderRadius:    8,
                      background:      'rgba(255,255,255,0.04)',
                      border:          '1px solid rgba(255,255,255,0.08)',
                      color:           attachment ? '#94c864' : '#8892a4',
                      cursor:          loading || attachment ? 'not-allowed' : 'pointer',
                      opacity:         loading || attachment ? 0.5 : 1,
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                      flexShrink:      0,
                      transition:      'color 0.15s, border-color 0.15s, opacity 0.15s',
                    }}
                    onMouseEnter={e => { if (!loading && !attachment) e.currentTarget.style.borderColor = 'rgba(0,212,232,0.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                  >
                    <PaperclipIcon />
                  </button>
                  <button
                    onClick={startVoice}
                    className={listening ? 'intel-mic-active' : ''}
                    title={listening ? 'Stop voice input' : 'Voice input'}
                    aria-label="Voice input"
                    style={{
                      width:           36,
                      height:          36,
                      borderRadius:    8,
                      background:      'rgba(255,255,255,0.04)',
                      border:          '1px solid rgba(255,255,255,0.08)',
                      color:           '#ffffff',
                      cursor:          'pointer',
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                      flexShrink:      0,
                      transition:      'color 0.15s, border-color 0.15s',
                    }}
                  >
                    <MicIcon />
                  </button>
                  {isStreaming ? (
                    <button
                      onClick={() => abortControllerRef.current && abortControllerRef.current.abort()}
                      title="Stop"
                      aria-label="Stop response"
                      style={{
                        width:           36,
                        height:          36,
                        borderRadius:    8,
                        background:      'rgba(255,255,255,0.04)',
                        border:          '1px solid rgba(255,255,255,0.12)',
                        color:           '#c8d0dc',
                        cursor:          'pointer',
                        display:         'flex',
                        alignItems:      'center',
                        justifyContent:  'center',
                        flexShrink:      0,
                        transition:      'border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,212,232,0.4)'; e.currentTarget.style.color = '#00d4e8' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#c8d0dc' }}
                    >
                      <StopIcon />
                    </button>
                  ) : (
                  <button
                    onClick={() => handleSend()}
                    disabled={(!input.trim() && !attachment) || loading}
                    style={{
                      width:           36,
                      height:          36,
                      borderRadius:    8,
                      background:      '#00d4e8',
                      border:          'none',
                      cursor:          (!input.trim() && !attachment) || loading ? 'not-allowed' : 'pointer',
                      opacity:         (!input.trim() && !attachment) || loading ? 0.3 : 1,
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                      flexShrink:      0,
                      transition:      'opacity 0.15s',
                    }}
                  >
                    <SendIcon />
                  </button>
                  )}
                </div>
              </div>

              <style>{`
                @keyframes intelDot {
                  0%, 80%, 100% { opacity: 0.3; }
                  40%           { opacity: 1;   }
                }
                @keyframes intelMicPulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(255,77,109,0.5); }
                  50%      { box-shadow: 0 0 0 6px rgba(255,77,109,0); }
                }
                .intel-mic-active {
                  animation: intelMicPulse 1.2s ease-in-out infinite;
                  border-color: #ff4d6d !important;
                  color: #ff4d6d !important;
                }
                .intel-input::placeholder { color: #8892a4; }
              `}</style>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
})

export default AskTheBrief
