import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ANTHROPIC_KEY, CONTACT_EMAIL } from '../config'

const SYSTEM_PROMPT = 'You are an outreach strategist for Bybit, Europe\'s leading crypto exchange. Draft professional, concise outreach for fintech comparison sites. Always lead with value for the site, not Bybit\'s needs. Keep responses under 250 words.'

// Mirrors GapCard's mailto pattern so the "Open in Mail" button delivers the
// same pre-filled subject + body that the gap row used to dispatch directly.
function urlPath(url) {
  if (!url) return ''
  const d = url.split('/')[0]
  const rest = url.slice(d.length)
  return (rest && rest !== '/') ? rest : ''
}
function buildOutreachMailto(site) {
  const domain = site.domain
  const path = urlPath(site.url)
  const body = `Hi ${domain} team,\n\nI'm reaching out from Bybit EU regarding a potential listing and partnership opportunity on ${domain}${path}.\n\nWe'd love to explore how Bybit could be featured alongside the exchanges you currently recommend.\n\nBest regards,\n${CONTACT_EMAIL}`
  const subject = 'Bybit EU — Partnership & Listing Opportunity'
  return `mailto:${site.contactEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function buildPrompt(type, site, custom) {
  const ctx = `Site: ${site.domain}\nCountry: ${site.country}\nCompetitors present: ${(site.competitors || []).join(', ')}\nGap tier: ${site.tier}`
  const templates = {
    cold: `Draft a concise cold outreach email (under 180 words) to the editorial or commercial team at ${site.domain}. They feature ${(site.competitors || []).join(', ')} but Bybit EU is not listed. Goal: get Bybit EU added to their exchange comparison. Reference Bybit EU GmbH\'s MiCA-compliant EU regulation, 1,400+ trading pairs, and competitive affiliate rates. Professional, direct, clear CTA.`,
    partner: `Write a partnership pitch email (under 180 words) for ${site.domain}. They list ${(site.competitors || []).join(', ')} but not Bybit. Propose a content partnership - exclusive market data, co-branded content, or priority commission tier - in exchange for Bybit EU placement in their top-exchanges table.`,
    card: `Draft a pitch email (under 180 words) about the Bybit Card - a Mastercard-backed crypto debit card with up to 10% cashback, instant conversion, available across the EEA. Target: ${site.domain}. Make the case for adding the Bybit Card to their card comparison content.`,
  }
  const task = templates[type] || custom
  return `Context:\n${ctx}\n\nTask:\n${task}`
}

export default function OutreachPanel({ site, onClose }) {
  const [input, setInput] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const responseRef = useRef()

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function send(prompt) {
    if (!ANTHROPIC_KEY) {
      setResponse('__NO_KEY__')
      return
    }
    setLoading(true)
    setResponse('')
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      setResponse(data.content?.[0]?.text || 'No response received.')
    } catch (e) {
      setResponse('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function copy() {
    navigator.clipboard.writeText(response)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!site) return null

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1498, backdropFilter: 'blur(4px)' }}
      />
      <motion.aside
        key="panel"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        style={{ position: 'fixed', top: 0, right: 0, width: 480, height: '100vh', background: '#0d1220', borderLeft: '1px solid var(--border)', zIndex: 1499, display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ flexShrink: 0, padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 13, color: 'var(--white)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Draft Outreach</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--cyan)', marginTop: 3 }}>{site.domain}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              href={buildOutreachMailto(site)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)',
                background: 'var(--cyan-dim)', border: '1px solid rgba(0,212,232,.3)',
                padding: '5px 10px', borderRadius: 4, cursor: 'pointer',
                letterSpacing: '.04em', textDecoration: 'none', whiteSpace: 'nowrap',
                transition: 'background .15s, border-color .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,232,.18)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--cyan-dim)' }}
            >
              ✉ Open in Mail
            </a>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, scrollbarWidth: 'thin' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 14px', marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-body)', lineHeight: 1.8 }}>
            {[['Site', site.domain],['Country', site.country],['Competitors', (site.competitors || []).join(', ') || '-'],['Tier', site.tier]].map(([k,v]) => (
              <div key={k} style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--text-muted)', minWidth: 100 }}>{k}:</span>
                <span style={{ color: 'var(--white)' }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[['cold','Cold Outreach'],['partner','Partnership Angle'],['card','Bybit Card Pitch']].map(([t,l]) => (
              <button key={t} onClick={() => send(buildPrompt(t, site, ''))}
                style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, padding: '7px 12px', borderRadius: 6, cursor: 'pointer', background: 'var(--bg-card-hover)', border: '1px solid var(--border)', color: 'var(--text-body)', transition: 'all .15s' }}
                onMouseEnter={e => { e.target.style.background='var(--cyan-dim)'; e.target.style.borderColor='rgba(0,212,232,.3)'; e.target.style.color='var(--white)' }}
                onMouseLeave={e => { e.target.style.background='var(--bg-card-hover)'; e.target.style.borderColor='var(--border)'; e.target.style.color='var(--text-body)' }}
              >{l}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              placeholder="Custom prompt..."
              style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '9px 12px', color: 'var(--white)', fontFamily: 'var(--font-body)', fontSize: 12, resize: 'none', height: 68, outline: 'none', lineHeight: 1.5 }}
            />
            <button onClick={() => send(buildPrompt(null, site, input))} disabled={loading || !input.trim()}
              style={{ padding: '0 16px', borderRadius: 6, background: 'var(--cyan)', color: '#0a0e1a', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', border: 'none', opacity: (!input.trim() || loading) ? 0.4 : 1 }}
            >Send</button>
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13 }}>
              <span className="spinner" /> Generating...
            </div>
          )}

          {response === '__NO_KEY__' && (
            <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(212,168,83,.2)', borderRadius: 6, padding: '14px 16px', fontSize: 13, color: 'var(--amber)', lineHeight: 1.6 }}>
              Add your Anthropic API key in <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>src/config.js</code> to enable AI drafting.
            </div>
          )}

          {response && response !== '__NO_KEY__' && (
            <div>
              <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontWeight: 300, fontSize: 13, color: 'var(--text-body)', lineHeight: 1.75, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 16px', marginBottom: 10 }} ref={responseRef}>
                {response}
              </div>
              <button onClick={copy} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '5px 12px', borderRadius: 4, background: copied ? 'var(--green-dim)' : 'var(--bg-card)', color: copied ? 'var(--green)' : 'var(--text-body)', border: `1px solid ${copied ? 'rgba(0,229,160,.3)' : 'var(--border)'}`, cursor: 'pointer' }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}
