import { useEffect, useState } from 'react'
import type { View } from '../App'

const STEPS: { sel?: string; view?: View; title: string; text: string }[] = [
  { title: 'Torque Stripe', text: 'A technician paints a torque stripe on a fastener once it is verified. If the mark moves, stop. This tool does the same for FAA proposed airworthiness directives: answers are quoted, checked by rules, or refused.' },
  { sel: '[data-tour="ask"]', view: 'ask', title: 'Set your model, ask a question', text: 'The aircraft or engine model drives every applicability check. Ask in plain words or name a docket.' },
  { sel: '[data-tour="chips"]', view: 'ask', title: 'Try the demo questions', text: 'Each one shows a different behaviour: answered, withdrawn, needs variant, not applicable, refused.' },
  { sel: '[data-tour="checks"]', view: 'ask', title: 'Rule checks, not AI judgement', text: 'Docket, latest version, regulatory status, model coverage and evidence are each a deterministic rule. You see every pass and stop.' },
  { sel: '[data-tour="proposal"]', view: 'ask', title: 'The proposal at a glance', text: 'Proposals are not binding. Withdrawn ones impose nothing. The dial shows how long the comment period has left.' },
  { sel: '[data-tour="radar"]', view: 'ask', title: 'Comment radar', text: 'Proposals that list your model and are still open for comment, by days left. Click a blip to open it.' },
  { sel: '[data-tab="eval"]', title: 'Measured, not claimed', text: '42 real questions: 42 correct, 0 of 16 unsafe answers. A plain search baseline gets 5 and 16 of 16 unsafe. Known failures are shown too.' },
]

export function Tour({ onClose, go }: { onClose(): void; go(v: View): void }) {
  const [i, setI] = useState(0)
  const [box, setBox] = useState<DOMRect | null>(null)
  const s = STEPS[i]
  useEffect(() => {
    if (s.view) go(s.view)
    const t = setTimeout(() => setBox(s.sel ? document.querySelector(s.sel)?.getBoundingClientRect() ?? null : null), 60)
    return () => clearTimeout(t)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  const last = i === STEPS.length - 1
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-t">
      {box && <div className="tour-ring" style={{ left: box.left - 6, top: box.top - 6, width: box.width + 12, height: box.height + 12 }} />}
      <div className="tour-card glass strong" style={box ? { left: Math.min(innerWidth - 380, Math.max(16, box.left)), top: box.bottom + 16 > innerHeight - 220 ? Math.max(16, box.top - 220) : box.bottom + 16 } : undefined}>
        <div className="label">Step {i + 1} of {STEPS.length}</div>
        <h3 id="tour-t">{s.title}</h3>
        <p>{s.text}</p>
        <div className="tour-acts">
          <button className="glass-btn" onClick={onClose}>Skip</button><span style={{ flex: 1 }} />
          {i > 0 && <button className="glass-btn" onClick={() => setI(i - 1)}>Back</button>}
          <button className="glass-btn pri" onClick={() => last ? onClose() : setI(i + 1)}>{last ? 'Start' : 'Next'}</button>
        </div>
      </div>
    </div>
  )
}
