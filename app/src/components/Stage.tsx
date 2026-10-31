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

/** Rendered aircraft. Decoration only: it shows the engine's verdict, never makes one. */
export const Stage = forwardRef<StageApi | null, { zoom?: number; onReady?: () => void }>(function Stage({ zoom, onReady }, ref) {
  const host = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null), api = useRef<StageApi | null>(null)
  const ready = useRef(onReady); ready.current = onReady
  useImperativeHandle(ref, () => new Proxy({} as StageApi, {
    get: (_t, k: keyof StageApi) => (...a: unknown[]) => (api.current?.[k] as ((...x: unknown[]) => unknown) | undefined)?.(...a),
  }), [])
  useEffect(() => {
    const s = createStage(cv.current!, host.current!, { spinSpeed: 0.08, lookY: 0.9, zoom: zoom ?? (innerWidth < 760 ? 1.5 : 1.25) }) as unknown as StageApi & { dispose(): void }
    api.current = s; ready.current?.()
    return () => { s.dispose(); api.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={host} className="stage-host" aria-hidden="true"><canvas ref={cv} /></div>
})
