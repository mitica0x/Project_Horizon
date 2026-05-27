import { useMemo, useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Star, Check, Lock } from 'lucide-react'
import { FONT_HEAD, FONT_MONO } from './horizonUI'

// COMPARE screen — exchange scoring inside the C0insiglieri app.
// Free tier sees scores; paid tier (Intelligence, $699/mo) sees the Signal
// Layer: pre-incident signals locked behind a blur + upgrade overlay.

const EASE_SOFT = [0.22, 1, 0.36, 1]
const EASE_SPRING = [0.34, 1.56, 0.64, 1]

const FILTERS = [
  { id: 'all',    label: 'ALL EXCHANGES' },
  { id: 'micar',  label: 'MiCAR ONLY' },
  { id: 'card',   label: 'CRYPTO CARD' },
  { id: 'futures',label: 'FUTURES' },
  { id: 'spot',   label: 'SPOT' },
]

const SORTS = [
  { id: 'score',      label: 'Score' },
  { id: 'security',   label: 'Security' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'liquidity',  label: 'Liquidity' },
]

// Logo via Clearbit Logo API. Domain → 32px (or 24px) icon. No backend lift.
const logoUrl = (domain, size = 32) =>
  `https://logo.clearbit.com/${domain}?size=${size}`

// 6 dimensions used by the Sc0RE formula; Bybit's per-dimension values are
// the canonical reference card. Other exchanges expose only the top-line
// score on the list view.
const BYBIT = {
  rank: 1,
  name: 'Bybit',
  domain: 'bybit.com',
  score: 94,
  dims: {
    security: 95,
    compliance: 88,
    liquidity: 96,
    por: 92,
    track: 90,
    product: 86,
  },
  vol24h: { value: '$12.4B', delta: '+8.2%', deltaTone: 'good' },
  spread: { value: '0.6bps', note: 'tight', tone: 'lime' },
  uptime: { value: '99.98%', note: 'stable', tone: 'good' },
  micar: true,
  featured: true,
}

const EXCHANGES = [
  { rank: 2, name: 'Kraken',     domain: 'kraken.com',     score: 91, micar: true,  flags: ['spot', 'futures'] },
  { rank: 3, name: 'Binance',    domain: 'binance.com',    score: 88, micar: false, flags: ['spot', 'futures', 'card'] },
  { rank: 4, name: 'OKX',        domain: 'okx.com',        score: 82, micar: false, flags: ['spot', 'futures'] },
  { rank: 5, name: 'Coinbase',   domain: 'coinbase.com',   score: 80, micar: true,  flags: ['spot', 'card'] },
  { rank: 6, name: 'WhiteBIT',   domain: 'whitebit.com',   score: 79, micar: false, flags: ['spot', 'futures'] },
  { rank: 7, name: 'Crypto.com', domain: 'crypto.com',     score: 77, micar: true,  flags: ['spot', 'card'] },
  { rank: 8, name: 'Bitstamp',   domain: 'bitstamp.net',   score: 75, micar: true,  flags: ['spot'] },
]

// Signal Layer — pre-incident intel, locked for free tier. Spec says blur +
// rgba(8,11,22,0.7) overlay + upgrade CTA.
const SIGNAL_PREVIEW = [
  {
    title: 'Personnel Movement',
    body: 'Legal/Compliance hiring surge detected across 3 EU jurisdictions',
  },
  {
    title: 'On-chain Pattern',
    body: 'Cold wallet outflow 12% above 30-day baseline — unusual rotation',
  },
  {
    title: 'Regulatory Radar',
    body: 'CCO registered in 3 jurisdictions simultaneously — pre-event signal',
  },
]

// Reveal a single child when it enters the viewport. Used for the exchange
// list rows so each animates only when scrolled into view (spec: score bars
// 0->value, 800ms spring, IntersectionObserver triggered).
function useInView(once = true) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          if (once) io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [once])
  return [ref, shown]
}

export default function CompareScreen() {
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('score')

  const rows = useMemo(() => {
    let list = EXCHANGES
    if (filter === 'micar')   list = list.filter(e => e.micar)
    if (filter === 'card')    list = list.filter(e => (e.flags || []).includes('card'))
    if (filter === 'futures') list = list.filter(e => (e.flags || []).includes('futures'))
    if (filter === 'spot')    list = list.filter(e => (e.flags || []).includes('spot'))
    return [...list].sort((a, b) => b.score - a.score)
  }, [filter])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        minHeight: 'calc(100vh - 44px)',
        paddingTop: 44,
      }}
    >
      {/* ── LEFT — sticky filter panel ─────────────────────────────────── */}
      <aside
        style={{
          position: 'sticky',
          top: 44,
          alignSelf: 'start',
          height: 'calc(100vh - 44px)',
          borderRight: '0.5px solid rgba(255,255,255,0.07)',
          padding: '24px 16px',
          background: '#0f1422',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#71717a',
            marginBottom: 12,
          }}
        >
          Exchange Intel
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {FILTERS.map(f => (
            <FilterChip
              key={f.id}
              label={f.label}
              active={filter === f.id}
              onClick={() => setFilter(f.id)}
            />
          ))}
        </div>

        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#3f3f46',
            marginTop: 24,
            marginBottom: 8,
          }}
        >
          Sort by
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SORTS.map(s => (
            <SortOption
              key={s.id}
              label={s.label}
              active={sort === s.id}
              onClick={() => setSort(s.id)}
            />
          ))}
        </div>
      </aside>

      {/* ── RIGHT — main content ──────────────────────────────────────── */}
      <section style={{ padding: '32px 32px 64px', minWidth: 0 }}>
        {/* Hero line */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_SOFT }}
          style={{
            fontFamily: FONT_HEAD,
            fontSize: 28,
            fontWeight: 700,
            color: '#e4e4e7',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          The leaderboard nobody paid to be on.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_SOFT, delay: 0.06 }}
          style={{
            fontFamily: FONT_HEAD,
            fontSize: 14,
            color: '#71717a',
            margin: '6px 0 28px',
          }}
        >
          Scored by algorithm. Not by who pays us.
        </motion.p>

        {/* Bybit featured card */}
        <BybitFeaturedCard exchange={BYBIT} />

        {/* Exchange list */}
        <div style={{ marginTop: 32 }}>
          {rows.map((ex, i) => (
            <ExchangeRow key={ex.domain} exchange={ex} idx={i} />
          ))}
          {rows.length === 0 && (
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12,
                color: '#71717a',
                padding: '24px 0',
                textAlign: 'center',
              }}
            >
              No exchanges match this filter.
            </div>
          )}
        </div>

        {/* Signal Layer — paywalled previews */}
        <SignalLayer />
      </section>
    </div>
  )
}

// ─── Filter chip (stacked, full-width) ────────────────────────────────────────
function FilterChip({ label, active, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '100%',
        height: 28,
        padding: '0 10px',
        background: active
          ? '#0dbe82'
          : hover
          ? 'rgba(255,255,255,0.03)'
          : 'transparent',
        color: active ? '#080b16' : '#b8c4d4',
        border: active
          ? '0.5px solid #0dbe82'
          : '0.5px solid rgba(255,255,255,0.07)',
        borderRadius: 3,
        fontFamily: FONT_MONO,
        fontSize: 11,
        fontWeight: active ? 700 : 500,
        letterSpacing: '0.08em',
        cursor: 'pointer',
        transition: 'background 150ms cubic-bezier(0.16, 1, 0.3, 1), color 150ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {label}
    </button>
  )
}

function SortOption({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 4px',
        background: 'transparent',
        border: 'none',
        color: active ? '#e4e4e7' : '#71717a',
        fontFamily: FONT_HEAD,
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: active ? '#0dbe82' : 'transparent',
          border: `0.5px solid ${active ? '#0dbe82' : 'rgba(255,255,255,0.2)'}`,
          flexShrink: 0,
        }}
      />
      {label}
    </button>
  )
}

// ─── Bybit featured card ─────────────────────────────────────────────────────
function BybitFeaturedCard({ exchange }) {
  const [ref, shown] = useInView()
  const dimLabels = {
    security: 'Security',
    compliance: 'Compliance',
    liquidity: 'Liquidity',
    por: 'PoR',
    track: 'Track Record',
    product: 'Product Depth',
  }
  const dims = Object.entries(exchange.dims).map(([k, v]) => ({
    key: k,
    label: dimLabels[k] || k,
    value: v,
  }))

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={shown ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr 0.9fr',
        gap: 24,
        alignItems: 'center',
        background: '#0f1422',
        border: '0.5px solid rgba(232,112,58,0.2)',
        borderLeft: '3px solid #e8703a',
        borderRadius: 3,
        padding: '20px 24px',
      }}
    >
      {/* LEFT — rank + logo + name + badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 32,
            fontWeight: 700,
            color: '#3f3f46',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          #{exchange.rank}
        </span>
        <img
          src={logoUrl(exchange.domain, 32)}
          alt={exchange.name}
          width={32}
          height={32}
          loading="lazy"
          style={{ borderRadius: 3, flexShrink: 0, background: '#0f1422' }}
          onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONT_HEAD,
              fontSize: 18,
              fontWeight: 700,
              color: '#e4e4e7',
              lineHeight: 1.2,
            }}
          >
            {exchange.name}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <Chip color="#e8703a" rgb="232,112,58">
              <Star size={9} strokeWidth={2.5} fill="#e8703a" />
              FEATURED
            </Chip>
            {exchange.micar && (
              <Chip color="#0dbe82" rgb="13,190,130">
                <Check size={9} strokeWidth={2.5} />
                MiCAR
              </Chip>
            )}
          </div>
        </div>
      </div>

      {/* CENTER — score ring + 6 dimension mini-bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <ScoreRing value={exchange.score} shown={shown} />
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 80px', columnGap: 8, rowGap: 4, alignItems: 'center', minWidth: 0 }}>
          {dims.map((d, i) => (
            <DimensionBar key={d.key} label={d.label} value={d.value} shown={shown} delay={0.06 * i} />
          ))}
        </div>
      </div>

      {/* RIGHT — 3 metrics + CTA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <Metric label="24H VOL" value={exchange.vol24h.value} delta={exchange.vol24h.delta} />
        <Metric label="SPREAD BTC" value={exchange.spread.value} note={exchange.spread.note} noteTone="lime" />
        <Metric label="UPTIME 90D" value={exchange.uptime.value} note={exchange.uptime.note} noteTone="emerald" />
        <a
          href={`https://${exchange.domain}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 8,
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: '#18b4d4',
            textDecoration: 'none',
            letterSpacing: '0.04em',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline' }}
          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none' }}
        >
          View Full Analysis →
        </a>
      </div>
    </motion.div>
  )
}

function Chip({ children, color, rgb }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
        background: `rgba(${rgb},0.1)`,
        color,
        border: `0.5px solid rgba(${rgb},0.5)`,
        borderRadius: 3,
        fontFamily: FONT_MONO,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
      }}
    >
      {children}
    </span>
  )
}

// ─── Score ring — 64px circular progress ─────────────────────────────────────
function ScoreRing({ value, shown }) {
  const size = 64
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (value / 100) * c
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#0dbe82"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={shown ? offset : c}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 800ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT_MONO,
          fontSize: 22,
          fontWeight: 700,
          color: '#0dbe82',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Dimension mini-bar ──────────────────────────────────────────────────────
function DimensionBar({ label, value, shown, delay = 0 }) {
  return (
    <>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          color: '#71717a',
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <div
        style={{
          width: 80,
          height: 2,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: shown ? `${value}%` : 0,
            height: '100%',
            background: '#0dbe82',
            transition: `width 800ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s`,
          }}
        />
      </div>
    </>
  )
}

function Metric({ label, value, delta, note, noteTone }) {
  const noteColor =
    noteTone === 'lime' ? '#70a848'
    : noteTone === 'emerald' ? '#0dbe82'
    : '#71717a'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        fontFamily: FONT_MONO,
        fontSize: 12,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: '#71717a', fontSize: 10, letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ color: '#e4e4e7' }}>{value}</span>
      {delta && (
        <span style={{ color: '#0dbe82', fontSize: 11 }}>{delta}</span>
      )}
      {note && (
        <span style={{ color: noteColor, fontSize: 11 }}>{note}</span>
      )}
    </div>
  )
}

// ─── Single exchange row ─────────────────────────────────────────────────────
function ExchangeRow({ exchange, idx }) {
  const [ref, shown] = useInView()
  const [hover, setHover] = useState(false)
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={shown ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.35, ease: EASE_SOFT, delay: idx * 0.04 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 32px 1fr 140px 50px 60px 70px',
        alignItems: 'center',
        gap: 14,
        height: 52,
        padding: '0 8px',
        borderBottom: '0.5px solid rgba(255,255,255,0.07)',
        background: hover ? 'rgba(255,255,255,0.02)' : 'transparent',
        transition: 'background 150ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: '#3f3f46' }}>
        #{exchange.rank}
      </span>
      <img
        src={logoUrl(exchange.domain, 24)}
        alt={exchange.name}
        width={24}
        height={24}
        loading="lazy"
        style={{ borderRadius: 3, background: '#0f1422' }}
        onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
      />
      <span style={{ fontFamily: FONT_HEAD, fontSize: 14, color: '#e4e4e7' }}>
        {exchange.name}
      </span>
      <div
        style={{
          width: 120,
          height: 3,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: shown ? `${exchange.score}%` : 0,
            height: '100%',
            background: '#0dbe82',
            transition: 'width 800ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      </div>
      <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: '#e4e4e7' }}>
        {exchange.score}
      </span>
      <span>
        {exchange.micar && (
          <Chip color="#0dbe82" rgb="13,190,130">
            MiCAR
          </Chip>
        )}
      </span>
      <a
        href={`https://${exchange.domain}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          color: '#18b4d4',
          textDecoration: 'none',
          textAlign: 'right',
          letterSpacing: '0.04em',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline' }}
        onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none' }}
      >
        Visit →
      </a>
    </motion.div>
  )
}

// ─── Signal Layer — paywalled previews ───────────────────────────────────────
function SignalLayer() {
  return (
    <div style={{ marginTop: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#18b4d4',
            boxShadow: '0 0 6px #18b4d4',
            animation: 'livePulse 2s ease-in-out infinite',
          }}
        />
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#18b4d4',
          }}
        >
          Signal Layer
        </span>
      </div>
      <p
        style={{
          fontFamily: FONT_HEAD,
          fontSize: 13,
          color: '#71717a',
          margin: '0 0 16px',
        }}
      >
        Pre-incident intelligence. Moves before the market knows.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16,
        }}
      >
        {SIGNAL_PREVIEW.map((s, i) => (
          <LockedSignalCard key={s.title} signal={s} idx={i} />
        ))}
      </div>
    </div>
  )
}

function LockedSignalCard({ signal, idx }) {
  const [ref, shown] = useInView()
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={shown ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, ease: EASE_SOFT, delay: idx * 0.08 }}
      style={{
        position: 'relative',
        background: '#0f1422',
        border: '0.5px solid rgba(255,255,255,0.07)',
        borderRadius: 3,
        padding: 16,
        minHeight: 132,
        overflow: 'hidden',
      }}
    >
      {/* Blurred content */}
      <div
        style={{
          filter: 'blur(4px)',
          opacity: 0.3,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: '#18b4d4',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          {signal.title}
        </div>
        <div
          style={{
            fontFamily: FONT_HEAD,
            fontSize: 13,
            color: '#e4e4e7',
            lineHeight: 1.5,
          }}
        >
          {signal.body}
        </div>
      </div>

      {/* Lock overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={shown ? { opacity: 1 } : {}}
        transition={{ duration: 0.3, delay: idx * 0.08 + 0.15 }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(8,11,22,0.7)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: 16,
        }}
      >
        <Lock size={16} strokeWidth={1.75} color="#71717a" />
        <div
          style={{
            fontFamily: FONT_HEAD,
            fontSize: 13,
            color: '#e4e4e7',
            textAlign: 'center',
          }}
        >
          Available on Intelligence
        </div>
        <button
          onClick={() => window.open('https://coinsiglieri.com/pricing', '_blank', 'noopener,noreferrer')}
          style={{
            background: '#0dbe82',
            color: '#080b16',
            border: 'none',
            borderRadius: 3,
            padding: '7px 12px',
            fontFamily: FONT_MONO,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            cursor: 'pointer',
            transition: 'background 150ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#6ef5c4' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#0dbe82' }}
        >
          Upgrade to $699/mo →
        </button>
      </motion.div>
    </motion.div>
  )
}
