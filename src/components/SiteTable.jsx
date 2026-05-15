import { useState, useEffect } from 'react'
import { TABLE_DATA } from '../data/staticData'
import { fetchAllRecords } from '../services/airtable'

const EU_FLAGS = { DE:'🇩🇪', FR:'🇫🇷', ES:'🇪🇸', PL:'🇵🇱', IT:'🇮🇹', NL:'🇳🇱', SE:'🇸🇪', EU:'🇪🇺', GB:'🇬🇧', UK:'🇬🇧' }

function countryLabel(country) {
  if (!country || country === 'GLOBAL')
    return { flag: '🌍', code: 'Global', color: '#8892a4', tooltip: 'Not EU-specific' }
  return { flag: EU_FLAGS[country] || '🌐', code: country, color: '#00d4e8', tooltip: null }
}

const DOT = { present: '#94c864', absent: '#D4A853', partial: '#D4A853' }
const PULSE = { present: '2.5s', absent: '1.8s', partial: '1.8s' }

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function FetchedAgo({ since }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!since) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [since])
  if (!since) return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8892a4' }}>Live · fetching…</span>
  const sec = Math.max(0, Math.floor((now - since) / 1000))
  const label = sec < 60 ? `${sec}s ago` : `${Math.floor(sec / 60)}m ago`
  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8892a4' }}>Live · fetched {label}</span>
}

export default function SiteTable({ openWithQuestion }) {
  const [rows, setRows] = useState(TABLE_DATA)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const [fetchedAt, setFetchedAt] = useState(null)

  useEffect(() => {
    fetchAllRecords()
      .then(records => {
        const map = {}
        records.forEach(r => { map[r.fields.url] = r.fields })
        setRows(prev => prev.map(row => {
          const at = map[row.url]
          if (!at) return row
          return { ...row, contactStatus: at.contact_status || 'Not Contacted' }
        }))
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false)
        setFetchedAt(Date.now())
      })
  }, [])

  useEffect(() => {
    if (loading) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [loading])

  const askAbout = (domain) => {
    if (!openWithQuestion) return
    openWithQuestion(`Tell me about ${domain} — is Bybit currently listed there, what tier is it, and which competitors are present on that site?`)
  }

  return (
    <>
      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .site-row { border-left: 2px solid transparent; }
        .site-row:hover { background: #1a2235 !important; border-left-color: #00d4e8 !important; }
        .site-row .ask-intel-btn { opacity: 0; transition: opacity 0.15s ease; pointer-events: none; }
        .site-row:hover .ask-intel-btn { opacity: 1; pointer-events: auto; }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <FetchedAgo since={fetchedAt} />
      </div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto', scrollbarWidth: 'thin' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#0b0f1e', zIndex: 5 }}>
              <tr>
                {['','Domain','Country','Tier','Bybit','Card','Competitors'].map((h,i) => (
                  <th key={i} style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '11px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const dotColor = DOT[row.status] || DOT.absent
                const dotDuration = PULSE[row.status] || PULSE.absent
                const stripe = i % 2 === 1 ? 'rgba(255,255,255,.018)' : 'transparent'
                return (
                  <tr
                    key={row.url}
                    className="site-row"
                    onClick={() => askAbout(row.domain)}
                    style={{
                      cursor: 'pointer',
                      background: stripe,
                      opacity: visible ? 1 : 0,
                      transform: visible ? 'translateY(0)' : 'translateY(8px)',
                      transition: `opacity 0.3s ease ${i * 35}ms, transform 0.3s ease ${i * 35}ms, background 0.15s ease, border-left-color 0.15s ease`,
                    }}
                  >
                    <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: dotColor,
                        boxShadow: `0 0 0 4px ${hexToRgba(dotColor, 0.25)}`,
                        animation: `statusPulse ${dotDuration} ease-in-out infinite`,
                      }} />
                    </td>
                    <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, color: 'var(--white)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.domain}</td>
                    <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {(() => { const { flag, code, color, tooltip } = countryLabel(row.country); return <span title={tooltip || undefined} style={{ color }}>{flag} {code}</span> })()}
                    </td>
                    <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 11, color: row.tier === 'Tier 1' ? 'var(--t1)' : 'var(--amber)' }}>{row.tier}</td>
                    <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 13, color: row.status === 'present' ? 'var(--green)' : 'var(--text-muted)' }}>{row.status === 'present' ? 'Yes' : '-'}</td>
                    <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 13, color: row.card ? 'var(--cyan)' : 'var(--text-muted)' }}>{row.card ? 'Yes' : '-'}</td>
                    <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', position: 'relative' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingRight: 96 }}>
                        {(row.competitors || []).slice(0,3).map(c => (
                          <span key={c} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 6px', borderRadius: 3, background: 'rgba(255,255,255,.05)', color: '#ffffff' }}>{c}</span>
                        ))}
                      </div>
                      <button
                        className="ask-intel-btn"
                        onClick={(e) => { e.stopPropagation(); askAbout(row.domain) }}
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          color: '#94c864',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px 8px',
                        }}
                      >
                        Ask Intel →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
