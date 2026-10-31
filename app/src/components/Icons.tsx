import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({ width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p })

export const IconAsk = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
export const IconFleet = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M2.5 13.5 21 8l-1.2 3.2-6.3 2.1-3 6.2H8.6l1.3-5.2-4.6 1.4-1.6 2H2.2l.9-3.3Z" /></svg>
export const IconInsights = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
export const IconEval = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6Z" /><path d="m8.8 12 2.2 2.2 4.4-4.6" /></svg>
export const IconChecks = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="3.5" y="4" width="17" height="16" rx="3" /><path d="M7.5 9h4M7.5 13h6M7.5 17h3M16 9l1 1 2-2" /></svg>
export const IconDoc = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>
export const IconQuote = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 18c2.5-1 4-3 4-6V7H4v5h3M15 18c2.5-1 4-3 4-6V7h-5v5h3" /></svg>
export const IconHelp = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6M12 17.2v.1" /></svg>
export const IconLink = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
export const IconCube = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></svg>

export function Logo({ size = 28 }: { size?: number }) {
  // Hex bolt head with the torque stripe painted across the joint (same geometry as /logo.svg).
  const hex = '49.32,42 32,52 14.68,42 14.68,22 32,12 49.32,22'
  const bar = <rect x="28" y="3" width="8" height="58" rx="1.2" fill="#0085CA" transform="rotate(32 32 32)" />
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs><clipPath id="ts-hex"><polygon points={hex} /></clipPath></defs>
      {bar}
      <polygon points={hex} fill="#00205B" />
      <g clipPath="url(#ts-hex)">{bar}</g>
      <polygon points={hex} fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinejoin="round" />
    </svg>
  )
}
