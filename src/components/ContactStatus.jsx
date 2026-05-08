import { useState } from 'react'
import * as Select from '@radix-ui/react-select'
import { patchContactStatus } from '../services/airtable'

const OPTIONS = [
  { value: 'Not Contacted', label: '- Not Contacted', color: '#4a5568' },
  { value: 'Contacted',     label: '● Contacted',     color: '#f59e0b' },
  { value: 'In Progress',   label: '◐ In Progress',   color: '#00d4e8' },
  { value: 'Done',          label: '✓ Done',           color: '#00e5a0' },
]

const BG = {
  'Not Contacted': 'transparent',
  'Contacted':     'rgba(245,158,11,0.12)',
  'In Progress':   'rgba(0,212,232,0.12)',
  'Done':          'rgba(0,229,160,0.10)',
}
const BORDER = {
  'Not Contacted': 'rgba(255,255,255,0.06)',
  'Contacted':     'rgba(245,158,11,0.35)',
  'In Progress':   'rgba(0,212,232,0.35)',
  'Done':          'rgba(0,229,160,0.35)',
}

export default function ContactStatus({ url, defaultValue = 'Not Contacted' }) {
  const [value, setValue] = useState(defaultValue)
  const [state, setState] = useState('idle')
  const opt = OPTIONS.find(o => o.value === value) || OPTIONS[0]

  async function handleChange(v) {
    setValue(v)
    setState('saving')
    try {
      await patchContactStatus(url, v)
      setState('ok')
    } catch {
      setState('err')
    }
    setTimeout(() => setState('idle'), 2500)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Select.Root value={value} onValueChange={handleChange}>
        <Select.Trigger style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
          background: BG[value], border: `1px solid ${BORDER[value]}`,
          color: opt.color, fontFamily: 'var(--font-body)', fontSize: 11,
          fontWeight: 500, whiteSpace: 'nowrap', outline: 'none',
        }}>
          <Select.Value>{opt.label}</Select.Value>
          <Select.Icon style={{ fontSize: 10, opacity: 0.7 }}>▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content style={{
            background: '#0d1220', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 6, overflow: 'hidden', minWidth: 148,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
            <Select.Viewport>
              {OPTIONS.map(o => (
                <Select.Item key={o.value} value={o.value} style={{
                  display: 'flex', alignItems: 'center', padding: '9px 14px',
                  cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12,
                  color: o.color, outline: 'none',
                }}>
                  <Select.ItemText>{o.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {state === 'saving' && <span className="spinner" />}
      {state === 'ok'    && <span style={{ color: '#00e5a0', fontSize: 12 }}>✓</span>}
      {state === 'err'   && <span style={{ color: '#ff4d6d', fontSize: 12 }}>✗</span>}
    </div>
  )
}
