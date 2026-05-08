import { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { TABLE_DATA } from '../data/staticData'
import { fetchAllRecords } from '../services/airtable'

gsap.registerPlugin(ScrollTrigger)

const EU_FLAGS = { DE:'🇩🇪', FR:'🇫🇷', ES:'🇪🇸', PL:'🇵🇱', IT:'🇮🇹', NL:'🇳🇱', SE:'🇸🇪', EU:'🇪🇺', GB:'🇬🇧', UK:'🇬🇧' }

function countryLabel(country) {
  if (!country || country === 'GLOBAL')
    return { flag: '🌍', code: 'Global', color: '#8892a4', tooltip: 'Not EU-specific' }
  return { flag: EU_FLAGS[country] || '🌐', code: country, color: '#00d4e8', tooltip: null }
}

const DOT = { present: '#00e5a0', absent: '#ff4d6d', partial: '#f59e0b' }

export default function SiteTable() {
  const [rows, setRows] = useState(TABLE_DATA)
  const [loading, setLoading] = useState(true)
  const tableRef = useRef()

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
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading) return
    const els = tableRef.current?.querySelectorAll('.site-row')
    if (!els?.length) return
    gsap.fromTo(els,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.3, stagger: 0.015,
        scrollTrigger: { trigger: tableRef.current, start: 'top 85%', once: true } }
    )
    return () => ScrollTrigger.getAll().forEach(t => t.kill())
  }, [loading])

  return (
    <div ref={tableRef} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
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
            {rows.map((row, i) => (
              <tr key={row.url} className="site-row" style={{ opacity: loading ? 0 : 1, background: i % 2 === 1 ? 'rgba(255,255,255,.018)' : 'transparent', transition: 'background .1s', cursor: 'default' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 1 ? 'rgba(255,255,255,.018)' : 'transparent'}
              >
                <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: DOT[row.status] || DOT.absent, boxShadow: `0 0 5px ${DOT[row.status] || DOT.absent}80` }} />
                </td>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, color: 'var(--white)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.domain}</td>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  {(() => { const { flag, code, color, tooltip } = countryLabel(row.country); return <span title={tooltip || undefined} style={{ color }}>{flag} {code}</span> })()}
                </td>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 11, color: row.tier === 'Tier 1' ? 'var(--t1)' : 'var(--amber)' }}>{row.tier}</td>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 13, color: row.status === 'present' ? 'var(--green)' : 'var(--text-muted)' }}>{row.status === 'present' ? 'Yes' : '-'}</td>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 13, color: row.card ? 'var(--cyan)' : 'var(--text-muted)' }}>{row.card ? 'Yes' : '-'}</td>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(row.competitors || []).slice(0,3).map(c => (
                      <span key={c} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 6px', borderRadius: 3, background: 'rgba(255,255,255,.05)', color: '#ffffff' }}>{c}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
