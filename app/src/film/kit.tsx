import type { CSSProperties, ReactNode } from 'react'

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const ease = (x: number) => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
export const out = (x: number) => 1 - Math.pow(1 - clamp(x), 3)
/** 0..1 progress of t through [a, b] */
export const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
export const mix = (a: number, b: number, k: number) => a + (b - a) * k
/** fade in over `fi` after a, fade out over `fo` before b */
export const vis = (t: number, a: number, b: number, fi = .5, fo = .5) => Math.min(out((t - a) / fi), out((b - t) / fo))

export interface PlateProps {
  src: string; x?: number; y?: number; w: number; rx?: number; ry?: number; rz?: number; z?: number
  o?: number; blur?: number; glow?: boolean; radius?: number; style?: CSSProperties
}
/** A captured app screen or panel, placed in 3D (1920x1080 space, centre-anchored). */
export function Plate({ src, x = 960, y = 540, w, rx = 0, ry = 0, rz = 0, z = 0, o = 1, blur = 0, glow, radius = 18, style }: PlateProps) {
  if (o <= 0.001) return null
  return (
    <img className={`plate${glow ? ' glow' : ''}`} src={`/film/plates/${src}.jpg`} alt="" style={{
      width: w, left: x, top: y, opacity: o, borderRadius: radius, filter: blur ? `blur(${blur}px)` : undefined,
      transform: `translate(-50%, -50%) translateZ(${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`, ...style,
    }} />
  )
}

export function Layer({ o = 1, children, style }: { o?: number; children: ReactNode; style?: CSSProperties }) {
  if (o <= 0.001) return null
  return <div className="flayer" style={{ opacity: o, ...style }}>{children}</div>
}

/** Text that types in over [a, a+dur]. */
export function Typed({ text, t, a, dur }: { text: string; t: number; a: number; dur: number }) {
  const n = Math.round(text.length * prog(t, a, a + dur))
  return <>{text.slice(0, n)}<span className="caret" style={{ opacity: n < text.length && Math.floor(t * 3) % 2 === 0 ? 1 : 0 }}>|</span></>
}
