import { useEffect, useId, useMemo, useRef, useState } from 'react'

/** Aircraft/engine model combobox. Opening it always shows the full list (the current model highlighted);
 *  typing filters. Free text is allowed, so unknown models still reach the rules (which refuse them). */
export function ModelPicker({ value, onChange, models, featured }: { value: string; onChange(v: string): void; models: string[]; featured: string[] }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState(false)          // filter only once the user types after opening
  const [hi, setHi] = useState(0)
  const input = useRef<HTMLInputElement>(null), list = useRef<HTMLUListElement>(null), id = useId()

  const items = useMemo(() => {
    const q = typed ? value.trim().toUpperCase() : ''
    if (!q) {
      const top = featured.filter(m => models.includes(m))
      return [...top.map(m => ({ m, group: 'Demo models' })), ...models.filter(m => !top.includes(m)).map(m => ({ m, group: 'All models' }))]
    }
    const starts = models.filter(m => m.startsWith(q)), has = models.filter(m => !m.startsWith(q) && m.includes(q))
    return [...starts, ...has].slice(0, 300).map(m => ({ m, group: '' }))
  }, [models, featured, value, typed])

  // on open, highlight and reveal the current model
  useEffect(() => {
    if (!open) return
    const i = typed ? 0 : Math.max(0, items.findIndex(x => x.m === value))
    setHi(i)
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ block: typed ? 'nearest' : 'center' }))
  }, [open, typed]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (m: string) => { onChange(m); setOpen(false); setTyped(false) }
  const show = (i: number) => { setHi(i); list.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest' }) }

  return (
    <div className="mp" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setOpen(false); setTyped(false) } }}>
      <div className="mp-row">
        <input ref={input} className="mono" value={value} placeholder="e.g. AS350B3" spellCheck={false} autoComplete="off"
          role="combobox" aria-label="Aircraft or engine model" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={open && items[hi] ? `${id}-${hi}` : undefined}
          onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
          onChange={e => { onChange(e.target.value.toUpperCase()); setTyped(true); setOpen(true) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); else show(Math.min(items.length - 1, hi + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); show(Math.max(0, hi - 1)) }
            else if (e.key === 'Enter' && open && items[hi] && typed) { e.preventDefault(); pick(items[hi].m) }
            else if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false); setTyped(false) }
          }} />
        {value && <button type="button" className="mp-clear" aria-label="Clear model" tabIndex={-1} onMouseDown={e => e.preventDefault()} onClick={() => { onChange(''); setTyped(true); setOpen(true); input.current?.focus() }}>×</button>}
        <button type="button" className="mp-chev" aria-label="Show all models" tabIndex={-1} onMouseDown={e => e.preventDefault()}
          onClick={() => { if (open && !typed) setOpen(false); else { setTyped(false); setOpen(true); input.current?.focus() } }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>
      {open && (
        <ul ref={list} id={`${id}-list`} role="listbox" tabIndex={-1} className="mp-list glass strong" aria-label="Aircraft and engine models">
          {items.length ? items.map(({ m, group }, i) => (
            <li key={m + group} role="presentation">
              {group && (i === 0 || items[i - 1].group !== group) && <div className="mp-group">{group}{group === 'All models' ? ` · ${models.length}` : ''}</div>}
              <div id={`${id}-${i}`} data-i={i} role="option" aria-selected={m === value} className={`mp-opt mono${i === hi ? ' hi' : ''}${m === value ? ' sel' : ''}`}
                onMouseDown={e => e.preventDefault()} onMouseEnter={() => setHi(i)} onClick={() => pick(m)}>
                {m}{m === value && <span className="mp-tick" aria-hidden="true">✓</span>}
              </div>
            </li>
          )) : <li className="mp-empty">No model in the dataset matches “{value}”. You can still ask; the rules will say if it is unknown.</li>}
        </ul>
      )}
    </div>
  )
}
