import { useEffect, useRef, useState } from 'react';
import { TABLE_DATA as SITE_TABLE_DATA } from '../data/staticData';

const SCORE = 52;
const SWEEP_DURATION = 9000;
const R = 390;

const BLIPS = SITE_TABLE_DATA.map((site, i) => {
  // seeded pseudo-random — deterministic, different per slot
  const s1 = (i * 127 + 31) % 97;
  const s2 = (i * 61 + 17) % 83;
  const s3 = (i * 43 + 7)  % 71;
  const bybit = site.status === 'present';
  const tierMatch = String(site.tier || '').match(/\d+/);
  const tier = tierMatch ? parseInt(tierMatch[0], 10) : 2;
  // chaotic angle — full 360, no even distribution
  const angle = (s1 / 97) * 360 + (s2 / 83) * 40 - 20;
  // radius band by tier with jitter
  const rBase = 0.25 + (s3 / 71) * 0.72;
  const r = Math.min(Math.max(rBase + (s1 / 97) * 0.18 - 0.09, 0.18), 0.97);
  // drift speed — tiny, different per dot
  const driftSpeed = 0.00008 + (s2 / 83) * 0.00014;
  const driftDir   = s1 % 2 === 0 ? 1 : -1;
  return {
    angle, r,
    domain: site.domain || site.url || '',
    bybit, tier,
    driftSpeed, driftDir,
    currentAngle: angle,
  };
});

function blipXY(angle, r) {
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: R + Math.cos(rad) * r * R, y: R + Math.sin(rad) * r * R };
}

// "active scan" = backend agent currently running. complete/error/idle don't get the in-flight visual treatment.
const isActivelyScanning = (s) => s === 'sentry' || s === 'mirror' || s === 'herald';

const SWEEP_BG_IDLE = 'conic-gradient(from 0deg, transparent 0deg, rgba(0,212,232,0.18) 0deg, transparent 70deg)';
const SWEEP_BG_SCAN = 'conic-gradient(from 0deg, transparent 0deg, rgba(0,212,232,0.45) 0deg, transparent 70deg)';

export default function HeroCanvas({ scanState = 'idle' } = {}) {
  const [score, setScore] = useState(0);
  const [hovered, setHovered] = useState(null);
  const [runId, setRunId] = useState(0);
  const [showBlueFlash, setShowBlueFlash] = useState(false);
  const radarRef   = useRef(null);
  const mouseRef   = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const rafRef        = useRef(null);
  const sweepRef       = useRef(null);
  const sweepAngleRef  = useRef(0);
  const sweepTargetRef = useRef(0);
  const blipsRef       = useRef(BLIPS.map(b => ({ ...b })));
  const scanStateRef   = useRef(scanState);

  // mirror scanState into a ref so the rAF loop can read latest without re-binding
  useEffect(() => {
    scanStateRef.current = scanState;
    console.log('[HeroCanvas] scanState ->', scanState);
  }, [scanState]);

  // brighten / restore the sweep gradient when scan toggles (state change, not per-frame)
  useEffect(() => {
    if (sweepRef.current) {
      sweepRef.current.style.background = isActivelyScanning(scanState)
        ? SWEEP_BG_SCAN
        : SWEEP_BG_IDLE;
    }
  }, [scanState]);

  // on scan complete: flash blue ring (1s) + restart score count-up
  useEffect(() => {
    if (scanState !== 'complete') return;
    setShowBlueFlash(true);
    const t = setTimeout(() => setShowBlueFlash(false), 1000);
    setScore(0);
    setRunId(id => id + 1);
    return () => clearTimeout(t);
  }, [scanState]);

  // count-up score (runs on mount and on every runId bump)
  useEffect(() => {
    let start = null;
    let raf;
    const duration = 1800;
    function step(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setScore(Math.round(p * SCORE));
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [runId]);

  // mouse parallax + sweep + blip drift loop
  useEffect(() => {
    function onMove(e) {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth  - 0.5) * 18,
        y: (e.clientY / window.innerHeight - 0.5) * 18,
      };
      const dx = e.clientX - window.innerWidth  / 2;
      const dy = e.clientY - window.innerHeight / 2;
      sweepTargetRef.current = Math.atan2(dy, dx) * (180 / Math.PI);
    }
    function loop() {
      const scanning = isActivelyScanning(scanStateRef.current);
      // scan stays at 3× (intentional); idle slowed to 0.4× to calm the dot drift.
      const speedMult = scanning ? 3 : 0.4;

      // Drift blips and update their DOM positions directly.
      // During scan: 3x speed + small per-frame angular jitter for "erratic" feel.
      blipsRef.current.forEach((b, i) => {
        const jitter = scanning ? (Math.random() - 0.5) * 0.3 : 0;
        b.currentAngle = (b.currentAngle + b.driftSpeed * b.driftDir * (180 / Math.PI) * speedMult + jitter) % 360;
        if (b.currentAngle < 0) b.currentAngle += 360;
        const el = document.getElementById(`blip-${i}`);
        if (el) {
          const { x, y } = blipXY(b.currentAngle, b.r);
          el.style.left = (x - 4) + 'px';
          el.style.top  = (y - 4) + 'px';
        }
      });

      const cur = currentRef.current;
      const tgt = mouseRef.current;
      cur.x += (tgt.x - cur.x) * 0.08;
      cur.y += (tgt.y - cur.y) * 0.08;
      if (radarRef.current) {
        radarRef.current.style.transform =
          `translate(calc(-50% + ${cur.x}px), calc(-50% + ${cur.y}px))`;
      }

      // Sweep: autonomous fast rotation during scan; mouse-follow lerp otherwise.
      if (scanning) {
        sweepAngleRef.current = (sweepAngleRef.current + 4) % 360;  // ~1.5s/full sweep at 60fps
      } else {
        let delta = sweepTargetRef.current - sweepAngleRef.current;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        sweepAngleRef.current += delta * 0.03;  // idle mouse-follow lerp halved (was 0.06)
      }
      if (sweepRef.current) {
        sweepRef.current.style.transform = `rotate(${sweepAngleRef.current}deg)`;
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    window.addEventListener('mousemove', onMove);
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const tooltip = hovered ? (() => {
    const live = blipsRef.current[hovered.index];
    const ang  = live ? live.currentAngle : hovered.angle;
    const rad  = live ? live.r            : hovered.r;
    const { x, y } = blipXY(ang, rad);
    const color = hovered.bybit
      ? '#00d4e8'
      : hovered.tier === 1 ? '#f59e0b'
      : hovered.tier === 2 ? '#60a5fa'
      : '#7B5EA7';
    const label = hovered.bybit ? '● BYBIT PRESENT' : `● GAP — TIER ${hovered.tier}`;
    return (
      <div style={{
        position: 'absolute',
        left: x, top: y - 14,
        transform: 'translate(-50%, -100%)',
        background: '#131929',
        border: `1px solid ${color}`,
        borderRadius: 4,
        padding: '8px 12px',
        pointerEvents: 'none',
        zIndex: 200,
        whiteSpace: 'nowrap',
      }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#fff' }}>
          {hovered.domain}
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
          color, letterSpacing: '0.08em', marginTop: 4 }}>
          {label}
        </div>
      </div>
    );
  })() : null;

  const scanning = isActivelyScanning(scanState);

  return (
    <section style={{ position: 'relative', width: '100%', height: '100vh',
      background: '#0a0e1a', overflow: 'hidden', display: 'flex',
      alignItems: 'center', justifyContent: 'center' }}>

      {/* radar */}
      <div ref={radarRef} style={{ position:'absolute', top:'50%', left:'50%',
        transform:'translate(-50%,-50%)', width: R*2, height: R*2 }}>

        {/* amber haze bloom — behind everything in the radar; visible only during active scan */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(circle at center, rgba(212,168,83,0.18) 0%, transparent 50%)',
          opacity: scanning ? 1 : 0,
          transition: 'opacity 300ms ease-out',
        }} />

        {/* sweep — background mutated via useEffect when scanState toggles */}
        <div ref={sweepRef} style={{ position:'absolute', inset:0, borderRadius:'50%',
          transformOrigin:'center center',
          background: SWEEP_BG_IDLE,
        }} />

        {/* SVG rings + crosshairs + scan-state outer-ring overlays */}
        <svg width={R*2} height={R*2} style={{ position:'absolute', inset:0 }}>
          {[1, 0.75, 0.5, 0.25].map((f,i) => (
            <circle key={i} cx={R} cy={R} r={R*f}
              fill="none" stroke="#00d4e8"
              strokeOpacity={i===0?0.3:0.12} strokeWidth={1} />
          ))}
          <line x1={R} y1={0} x2={R} y2={R*2}
            stroke="#00d4e8" strokeOpacity={0.08} strokeWidth={1}/>
          <line x1={0} y1={R} x2={R*2} y2={R}
            stroke="#00d4e8" strokeOpacity={0.08} strokeWidth={1}/>
          <line x1={R-R*0.707} y1={R-R*0.707} x2={R+R*0.707} y2={R+R*0.707}
            stroke="#00d4e8" strokeOpacity={0.06} strokeWidth={1}/>
          <line x1={R+R*0.707} y1={R-R*0.707} x2={R-R*0.707} y2={R+R*0.707}
            stroke="#00d4e8" strokeOpacity={0.06} strokeWidth={1}/>

          {/* amber outer-ring breathing pulse — animation only while actively scanning */}
          <circle cx={R} cy={R} r={R}
            fill="none" stroke="#D4A853" strokeWidth={2}
            style={{
              strokeOpacity: 0,
              transition: 'stroke-opacity 300ms ease-out',
              animation: scanning ? 'amberPulse 2.4s ease-in-out infinite' : 'none',
            }}
          />

          {/* electric-blue verified-state flash on scan complete (instant in, 300ms fade out at the end of 1s) */}
          {showBlueFlash && (
            <circle cx={R} cy={R} r={R}
              fill="none" stroke="#4D7EFF" strokeWidth={2}
              style={{ strokeOpacity: 0, animation: 'blueFlash 1s ease-out' }}
            />
          )}
        </svg>

        {BLIPS.map((b, i) => {
          const { x, y } = blipXY(b.angle, b.r);
          const PALETTE = ['#00d4e8','#B8FF00','#f59e0b','#7B5EA7','#60a5fa','#00e5a0','#c8d0dc'];
          const colorIdx = b.bybit
            ? (i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 4)
            : (i % 7);
          const color = PALETTE[colorIdx];
          const delay = `${((b.angle / 360) * SWEEP_DURATION / 1000 - SWEEP_DURATION / 1000).toFixed(2)}s`;
          return (
            <div key={i}
              id={`blip-${i}`}
              onMouseEnter={() => setHovered({ ...b, index: i })}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: 'absolute', left: x - 4, top: y - 4,
                width: 8, height: 8, borderRadius: '50%', cursor: 'pointer',
                background: color,
                boxShadow: `0 0 8px ${color}`,
                animation: `blipPresent 2s ease-in-out ${delay} infinite`,
                zIndex: 10,
              }}
            />
          );
        })}

        {tooltip}
      </div>

      {/* overlay */}
      <div style={{ position:'relative', zIndex:50, textAlign:'center',
        fontFamily:"'Syne', sans-serif", pointerEvents:'none' }}>
        <div style={{ fontSize:96, fontWeight:700, lineHeight:1,
          color:'#00d4e8', fontFamily:"'IBM Plex Mono', monospace",
          opacity: scanning ? 0.3 : 1,
          transition: 'opacity 300ms ease-out',
        }}>
          {score}<span style={{ fontSize:32, color:'rgba(255,255,255,0.6)' }}>%</span>
        </div>
        <div style={{ fontSize:11, letterSpacing:'0.15em', color:'#8892a4', marginTop:8 }}>
          EU PRESENCE SCORE
        </div>
        <div style={{ display:'flex', gap:12, marginTop:32 }}>
          {[
            { label:'Sites Monitored', value:25, color:'#fff' },
            { label:'Bybit Present',   value:13, color:'#00d4e8' },
            { label:'Tier 1 Gaps',     value:9,  color:'#ff4d6d' },
            { label:'Brand Alerts',    value:1,  color:'#f59e0b' },
          ].map((k,i) => (
            <div key={i} style={{ background:'rgba(19,25,41,0.85)',
              border:'1px solid rgba(255,255,255,0.06)', borderRadius:8,
              padding:'16px 20px', minWidth:90, textAlign:'center' }}>
              <div style={{ fontSize:28, fontWeight:700, color:k.color,
                fontFamily:"'IBM Plex Mono', monospace" }}>{k.value}</div>
              <div style={{ fontSize:10, color:'#8892a4', marginTop:4,
                letterSpacing:'0.05em' }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* scroll chevron */}
      <div style={{ position:'absolute', bottom:24, left:'50%',
        transform:'translateX(-50%)', color:'#8892a4', fontSize:20,
        animation:'bounce 2s ease-in-out infinite' }}>↓</div>

      <style>{`
        @keyframes blipYG {
          0%,100% { transform: scale(1);   opacity: 0.55; }
          50%      { transform: scale(1.3); opacity: 0.7;  }
        }
        @keyframes blipSB {
          0%,100% { transform: scale(1);   opacity: 0.55; }
          50%      { transform: scale(1.2); opacity: 0.7;  }
        }
        @keyframes blipPresent {
          0%,100% { transform: scale(1);   opacity: 1; }
          50%      { transform: scale(1.8); opacity: 1; }
        }
        @keyframes blipGap {
          0%,100% { transform: scale(1);   opacity: 1; }
          50%      { transform: scale(2.0); opacity: 1; }
        }
        @keyframes bounce {
          0%,100% { transform: translateX(-50%) translateY(0); }
          50%      { transform: translateX(-50%) translateY(6px); }
        }
        @keyframes amberPulse {
          0%, 100% { stroke-opacity: 0.25; }
          50%      { stroke-opacity: 0.65; }
        }
        @keyframes blueFlash {
          0%   { stroke-opacity: 1; }
          70%  { stroke-opacity: 1; }
          100% { stroke-opacity: 0; }
        }
      `}</style>
    </section>
  );
}
