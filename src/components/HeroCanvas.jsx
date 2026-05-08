import { useEffect, useRef, useState } from 'react';

const SCORE = 31;
const SWEEP_DURATION = 9000;
const R = 390;

const PRESENT_BLIPS = [
  { angle: 15,  r: 0.45, domain: 'coincierge.de' },
  { angle: 42,  r: 0.72, domain: 'coingecko.com' },
  { angle: 78,  r: 0.38, domain: 'cryptonews.com' },
  { angle: 110, r: 0.65, domain: 'blockworks.co' },
  { angle: 145, r: 0.52, domain: 'tradersunion.com' },
  { angle: 190, r: 0.41, domain: 'captainaltcoin.com' },
  { angle: 225, r: 0.78, domain: 'datawallet.com' },
  { angle: 260, r: 0.33, domain: 'cryptogeek.info' },
  { angle: 300, r: 0.61, domain: 'cryptotips.eu' },
  { angle: 330, r: 0.48, domain: '99bitcoins.com' },
  { angle: 55,  r: 0.85, domain: 'coinmarketcap.com' },
  { angle: 170, r: 0.29, domain: 'cointelegraph.com' },
  { angle: 315, r: 0.77, domain: 'coincodex.com' },
];

const GAP_BLIPS = [
  { angle: 28,  r: 0.58, domain: 'investopedia.com' },
  { angle: 95,  r: 0.44, domain: 'nerdwallet.com' },
  { angle: 130, r: 0.81, domain: 'finder.com' },
  { angle: 175, r: 0.67, domain: 'money.co.uk' },
  { angle: 210, r: 0.55, domain: 'moneysavingexpert.com' },
  { angle: 248, r: 0.72, domain: 'comparethemarket.com' },
  { angle: 285, r: 0.39, domain: 'thisismoney.co.uk' },
  { angle: 345, r: 0.63, domain: 'uswitch.com' },
  { angle: 20,  r: 0.82, domain: 'coinbase.com' },
];

const YG_BLIPS = [
  { angle: 35,  r: 0.62, domain: 'coincub.com' },
  { angle: 88,  r: 0.45, domain: 'thebanks.eu' },
  { angle: 155, r: 0.75, domain: 'euinvestinghub.com' },
  { angle: 235, r: 0.38, domain: 'dutchreview.com' },
  { angle: 310, r: 0.58, domain: 'koinly.io' },
];

const SB_BLIPS = [
  { angle: 62,  r: 0.52, domain: 'finanzcheck.de' },
  { angle: 118, r: 0.82, domain: 'creditcard.nl' },
  { angle: 198, r: 0.35, domain: 'jeangalea.com' },
  { angle: 268, r: 0.65, domain: 'cryptowisser.com' },
  { angle: 342, r: 0.48, domain: 'coinranking.com' },
];

function blipXY(angle, r) {
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: R + Math.cos(rad) * r * R, y: R + Math.sin(rad) * r * R };
}

export default function HeroCanvas() {
  const [score, setScore] = useState(0);
  const [hovered, setHovered] = useState(null);
  const radarRef   = useRef(null);
  const mouseRef   = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const rafRef        = useRef(null);
  const sweepRef       = useRef(null);
  const sweepAngleRef  = useRef(0);
  const sweepTargetRef = useRef(0);

  // count-up score
  useEffect(() => {
    let start = null;
    const duration = 1800;
    function step(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setScore(Math.round(p * SCORE));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, []);

  // mouse parallax
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
      const cur = currentRef.current;
      const tgt = mouseRef.current;
      cur.x += (tgt.x - cur.x) * 0.08;
      cur.y += (tgt.y - cur.y) * 0.08;
      if (radarRef.current) {
        radarRef.current.style.transform =
          `translate(calc(-50% + ${cur.x}px), calc(-50% + ${cur.y}px))`;
      }
      let delta = sweepTargetRef.current - sweepAngleRef.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      sweepAngleRef.current += delta * 0.06;
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

  const TOOLTIP_COLOR = { present: '#00d4e8', gap: '#f59e0b', yg: '#B8FF00', sb: '#60a5fa' };
  const TOOLTIP_LABEL = { present: '● BYBIT PRESENT', gap: '● GAP OPPORTUNITY', yg: '● T1 COMPETITOR', sb: '● REVOLUT PRESENT' };

  const tooltip = hovered ? (() => {
    const { x, y } = blipXY(hovered.angle, hovered.r);
    const color = TOOLTIP_COLOR[hovered.type] || '#00d4e8';
    const label = TOOLTIP_LABEL[hovered.type] || '';
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

  return (
    <section style={{ position: 'relative', width: '100%', height: '100vh',
      background: '#0a0e1a', overflow: 'hidden', display: 'flex',
      alignItems: 'center', justifyContent: 'center' }}>

      {/* corner brackets */}
      {[{t:20,l:20},{t:20,r:20},{b:20,l:20},{b:20,r:20}].map((s,i) => (
        <div key={i} style={{ position:'absolute', width:24, height:24,
          borderTop:    i<2  ? '1px solid rgba(0,212,232,0.15)' : undefined,
          borderBottom: i>=2 ? '1px solid rgba(0,212,232,0.15)' : undefined,
          borderLeft:   (i===0||i===2) ? '1px solid rgba(0,212,232,0.15)' : undefined,
          borderRight:  (i===1||i===3) ? '1px solid rgba(0,212,232,0.15)' : undefined,
          top:s.t, bottom:s.b, left:s.l, right:s.r }} />
      ))}

      {/* radar */}
      <div ref={radarRef} style={{ position:'absolute', top:'50%', left:'50%',
        transform:'translate(-50%,-50%)', width: R*2, height: R*2 }}>
        {/* sweep */}
        <div ref={sweepRef} style={{ position:'absolute', inset:0, borderRadius:'50%',
          transformOrigin:'center center',
          background:`conic-gradient(from 0deg, transparent 0deg, rgba(0,212,232,0.18) 0deg, transparent 70deg)`,
        }} />

        {/* SVG rings + crosshairs */}
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
        </svg>

        {/* present blips */}
        {PRESENT_BLIPS.map((b,i) => {
          const {x,y} = blipXY(b.angle, b.r);
          const delay = `${((b.angle/360)*SWEEP_DURATION/1000 - SWEEP_DURATION/1000).toFixed(2)}s`;
          return (
            <div key={i}
              onMouseEnter={() => setHovered({...b, type:'present'})}
              onMouseLeave={() => setHovered(null)}
              style={{ position:'absolute', left:x-4, top:y-4,
                width:8, height:8, borderRadius:'50%', cursor:'pointer',
                background:'#00d4e8', boxShadow:'0 0 8px #00d4e8',
                animation:`blipPresent 2s ease-in-out ${delay} infinite`,
              }} />
          );
        })}

        {/* gap blips */}
        {GAP_BLIPS.map((b,i) => {
          const {x,y} = blipXY(b.angle, b.r);
          const delay = `${((b.angle/360)*SWEEP_DURATION/1000 - SWEEP_DURATION/1000).toFixed(2)}s`;
          return (
            <div key={i}
              onMouseEnter={() => setHovered({...b, type:'gap'})}
              onMouseLeave={() => setHovered(null)}
              style={{ position:'absolute', left:x-4, top:y-4,
                width:8, height:8, borderRadius:'50%', cursor:'pointer',
                background:'#f59e0b', boxShadow:'0 0 8px #f59e0b',
                animation:`blipGap 1.4s ease-in-out ${delay} infinite`,
              }} />
          );
        })}

        {YG_BLIPS.map((b,i) => {
          const {x,y} = blipXY(b.angle, b.r);
          const delay = `${((b.angle/360)*SWEEP_DURATION/1000 - SWEEP_DURATION/1000).toFixed(2)}s`;
          return (
            <div key={i}
              onMouseEnter={() => setHovered({...b, type:'yg'})}
              onMouseLeave={() => setHovered(null)}
              style={{ position:'absolute', left:x-4, top:y-4,
                width:8, height:8, borderRadius:'50%', cursor:'pointer',
                background:'#B8FF00', boxShadow:'0 0 4px rgba(184,255,0,0.35)',
                opacity:0.55,
                animation:`blipYG 2.2s ease-in-out ${delay} infinite`,
              }} />
          );
        })}

        {SB_BLIPS.map((b,i) => {
          const {x,y} = blipXY(b.angle, b.r);
          const delay = `${((b.angle/360)*SWEEP_DURATION/1000 - SWEEP_DURATION/1000).toFixed(2)}s`;
          return (
            <div key={i}
              onMouseEnter={() => setHovered({...b, type:'sb'})}
              onMouseLeave={() => setHovered(null)}
              style={{ position:'absolute', left:x-4, top:y-4,
                width:8, height:8, borderRadius:'50%', cursor:'pointer',
                background:'#60a5fa', boxShadow:'0 0 4px rgba(96,165,250,0.35)',
                opacity:0.55,
                animation:`blipSB 2.5s ease-in-out ${delay} infinite`,
              }} />
          );
        })}

        {tooltip}
      </div>

      {/* overlay */}
      <div style={{ position:'relative', zIndex:50, textAlign:'center',
        fontFamily:"'Syne', sans-serif", pointerEvents:'none' }}>
        <div style={{ fontSize:11, letterSpacing:'0.2em', color:'#8892a4',
          marginBottom:12, display:'flex', alignItems:'center',
          justifyContent:'center', gap:8 }}>
          <span style={{ width:6, height:6, borderRadius:'50%',
            background:'#00d4e8', display:'inline-block' }} />
          PROJECT HORIZON
        </div>
        <div style={{ fontSize:96, fontWeight:700, lineHeight:1,
          color:'#00d4e8', fontFamily:"'IBM Plex Mono', monospace" }}>
          {score}<span style={{ fontSize:32, color:'rgba(255,255,255,0.6)' }}>%</span>
        </div>
        <div style={{ fontSize:11, letterSpacing:'0.15em', color:'#8892a4', marginTop:8 }}>
          EU PRESENCE SCORE
        </div>
        <div style={{ display:'flex', gap:12, marginTop:32, pointerEvents:'auto' }}>
          {[
            { label:'Sites Monitored', value:53, color:'#fff' },
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
      `}</style>
    </section>
  );
}
