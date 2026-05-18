import { motion } from 'framer-motion'
import ContactStatus from './ContactStatus'
import { COMPETITOR_COLORS } from '../data/staticData'
import { SiteLink } from './horizonUI'

function urlPath(url) {
  const d = url.split('/')[0]
  const rest = url.slice(d.length)
  return (rest && rest !== '/') ? rest : ''
}

export default function WinCard({ win }) {
  const { url, domain, competitors, context, card } = win
  const path = urlPath(url)

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
      transition={{ duration: 0.15 }}
      style={{
        background: 'var(--bg-card)',
        borderRadius: 8, padding: '20px', marginBottom: 8,
        border: '1px solid rgba(0,229,160,0.10)',
        borderLeftWidth: 3, borderLeftColor: 'var(--green)', borderLeftStyle: 'solid',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 17, color: 'var(--white)' }}>
            <SiteLink domain={domain} path={path}>{domain}</SiteLink>
            {card && <span style={{ fontSize: 10, background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid rgba(0,212,232,.3)', padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-head)', fontWeight: 700, letterSpacing: '.05em' }}>CARD</span>}
          </div>
          {path && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}><SiteLink domain={domain} path={path}>{path}</SiteLink></div>}
        </div>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-head)', fontWeight: 700, padding: '2px 7px', borderRadius: 3, flexShrink: 0, background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(0,229,160,.4)' }}>WIN</span>
      </div>

      {context && (
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 300, fontSize: 14, color: 'var(--text-body)', lineHeight: 1.65, marginBottom: 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {context}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
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
        <ContactStatus url={url} />
      </div>
    </motion.div>
  )
}
