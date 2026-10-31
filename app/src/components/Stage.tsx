import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { createStage } from '../three/stage.js'

export interface StageApi {
  setKind(kind: string, model: string): void
  setState(s: string): void
  setZone(z: string | null): void
  setView(v: '3d' | 'top' | 'side'): void
  setRender(mode: 'solid' | 'wire'): void
  setCamera(o: { az?: number; el?: number; zoom?: number; spin?: number; lookY?: number }): void
  scan(): void
  kind(): string
  hasZone(z: string): boolean
  archetype(m: string, k: string): { key: string; label: string }
}

/** Full-bleed wireframe aircraft over a dusk valley. Decoration only: it shows the engine's verdict, never makes one. */
export const Stage = forwardRef<StageApi | null, { dim?: boolean }>(function Stage({ dim }, ref) {
  const host = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null), api = useRef<StageApi | null>(null)
  useEffect(() => {
    const s = createStage(cv.current!, host.current!, { spinSpeed: 0.08, lookY: 0.9, zoom: innerWidth < 860 ? 1.8 : 1.55 }) as unknown as StageApi & { dispose(): void }
    api.current = s
    return () => { s.dispose(); api.current = null }
  }, [])
  useImperativeHandle(ref, () => new Proxy({} as StageApi, {
    get: (_t, k: keyof StageApi) => (...a: unknown[]) => (api.current?.[k] as ((...x: unknown[]) => unknown) | undefined)?.(...a),
  }), [])
  return <div ref={host} className={`stage-host${dim ? ' dim' : ''}`} aria-hidden="true"><canvas ref={cv} /></div>
})
