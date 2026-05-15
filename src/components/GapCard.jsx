import { motion } from 'framer-motion'
import ContactStatus from './ContactStatus'
import { COMPETITOR_COLORS } from '../data/staticData'

function urlPath(url) {
  const d = url.split('/')[0]
  const rest = url.slice(d.length)
  return (rest && rest !== '/') ? rest : ''
}

const EU_FLAGS = { DE:'🇩🇪', FR:'🇫🇷', ES:'🇪🇸', PL:'🇵🇱', IT:'🇮🇹', NL:'🇳🇱', SE:'🇸🇪', EU:'🇪🇺', GB:'🇬🇧', UK:'🇬🇧' }

function countryLabel(country) {
  if (!country || country === 'GLOBAL')
    return { flag: '🌍', code: 'Global', color: '#8892a4', tooltip: 'Not EU-specific' }
  return { flag: EU_FLAGS[country] || '🌐', code: country, color: '#00d4e8', tooltip: null }
}

export default function GapCard({ gap, onDraftOutreach }) {
  const { url, domain, competitors, country, tier, review } = gap
  const path = urlPath(url)
  const isT1 = tier !== 'T2'

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
      transition={{ duration: 0.15 }}
      style={{
        background: 'var(--bg-card)',
        borderRadius: 8, padding: '20px', marginBottom: 8,
        borderLeft: `3px solid ${isT1 ? 'var(--t1)' : 'var(--amber)'}`,
        border: `1px solid ${isT1 ? 'rgba(148,200,100,0.15)' : 'rgba(212,168,83,0.15)'}`,
        borderLeftWidth: 3,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 17, color: 'var(--white)' }}>
            {domain}
            {review && <span style={{ fontSize: 10, background: 'rgba(212,168,83,0.15)', color: 'var(--amber)', border: '1px solid rgba(212,168,83,0.4)', padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-head)', fontWeight: 700, letterSpacing: '.05em' }}>REVIEW</span>}
          </div>
          {path && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{path}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {(() => { const { flag, code, color, tooltip } = countryLabel(country); return <span title={tooltip || undefined} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color }}>{flag} {code}</span> })()}
          <span style={{ fontSize: 11, fontFamily: 'var(--font-head)', fontWeight: 700, letterSpacing: '.06em', padding: '2px 7px', borderRadius: 3,
            background: isT1 ? 'var(--t1-dim)' : 'var(--amber-dim)',
            color: isT1 ? 'var(--t1)' : 'var(--amber)',
            border: isT1 ? '1px solid rgba(148,200,100,.4)' : '1px solid rgba(212,168,83,.4)',
          }}>
            {isT1 ? 'T1' : 'T2'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {(competitors || []).map(c => (
            <span key={c} style={{
              fontFamily: 'var(--font-mono)', fontSize: 12, padding: '3px 8px', borderRadius: 4,
              background: (COMPETITOR_COLORS[c] || '#8892a4') + '20',
              color: COMPETITOR_COLORS[c] || '#8892a4',
              border: `1px solid ${(COMPETITOR_COLORS[c] || '#8892a4')}40`,
            }}>{c}</span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onDraftOutreach(gap)}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)',
              background: 'none', border: '1px solid transparent', padding: '4px 9px',
              borderRadius: 4, cursor: 'pointer', letterSpacing: '.04em',
              transition: 'background .15s, border-color .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--cyan-dim)'; e.currentTarget.style.borderColor = 'rgba(0,212,232,.3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent' }}
          >
            ✦ Draft Outreach
          </button>
          <ContactStatus url={url} />
        </div>
      </div>
    </motion.div>
  )
}
