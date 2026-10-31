import type { FleetRow } from '../lib/types'
import { daysUntil } from '../lib/present'

const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }

/** Proposals listing the model whose comment period is still open, plotted by days left (centre = closes soonest). */
export function Radar({ fleet, today, model, onOpen }: { fleet: FleetRow | null; today: string; model: string; onOpen(d: string): void }) {
  const open = (fleet?.dockets || []).filter(d => d.comments_open && d.comments_due)
  const R = 62, H = 75
  return (
    <div className="hud br glass" data-tour="radar">
      <div className="ph" style={{ padding: '12px 14px 4px' }}>Comment radar<span className="meta">60 days</span></div>
      <div className="radar">
        <svg viewBox="0 0 150 150" role="img" aria-label={`${open.length} proposals listing ${model || 'this model'} are open for comment`}>
          <defs>
            <radialGradient id="rg"><stop offset="0" stopColor="rgba(0,133,202,.12)" /><stop offset="1" stopColor="rgba(0,133,202,0)" /></radialGradient>
            <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="rgba(0,133,202,0)" /><stop offset="1" stopColor="rgba(0,133,202,.35)" /></linearGradient>
          </defs>
          <circle cx={H} cy={H} r={R} fill="url(#rg)" />
          {[1, 2, 3, 4].map(i => <circle key={i} cx={H} cy={H} r={R * i / 4} fill="none" stroke="rgba(0,32,91,.14)" />)}
          <path d={`M${H} ${H - R}V${H + R}M${H - R} ${H}H${H + R}`} stroke="rgba(0,32,91,.1)" />
          <g className="sweep"><path d={`M${H} ${H}L${H + R} ${H}A${R} ${R} 0 0 0 ${H + R * Math.cos(-0.7)} ${H + R * Math.sin(-0.7)}Z`} fill="url(#sweep)" /></g>
          {open.map(d => {
            const days = Math.max(0, Math.min(60, daysUntil(d.comments_due!, today))), a = (hash(d.docket) % 360) * Math.PI / 180, r = 8 + (R - 8) * days / 60
            return (
              <g key={d.docket} className="blip" onClick={() => onOpen(d.docket)} style={{ cursor: 'pointer' }}>
                <title>{`${d.docket} · comments due ${d.comments_due} (${days} days)`}</title>
                <circle cx={H + r * Math.cos(a)} cy={H + r * Math.sin(a)} r="7" fill="transparent" />
                <circle cx={H + r * Math.cos(a)} cy={H + r * Math.sin(a)} r="3" fill="var(--molten)"  />
              </g>
            )
          })}
        </svg>
        <div className="radar-l">
          <div className="readout" style={{ fontSize: 40 }}>{open.length}</div>
          <div className="label">open for comment{model ? <> · <span className="mono">{model}</span></> : ''}</div>
          {open[0] && <button className="glass-btn" style={{ height: 30, marginTop: 8 }} onClick={() => onOpen(open[0].docket)}><span className="mono">{open[0].docket}</span></button>}
        </div>
      </div>
    </div>
  )
}
