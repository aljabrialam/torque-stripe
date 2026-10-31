// Torq, the Torque Stripe mascot: a hex bolt head with the torque stripe worn as a sash,
// an aviation ground-crew headset and work gloves, standing on its washer.
// Plain ES module so the app (React) and the Node graphics scripts share one drawing.
const NAVY = '#00205B', NAVY2 = '#0A2F78', SKY = '#0085CA', SKY2 = '#5CC3F0', INK = '#0B1F45', STEEL = '#C9D3E2', WHITE = '#FFFFFF', AMBER = '#FFB547'

const HEX = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 90); return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`
}).join(' ')

const glove = (x, y, r = 11) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>`
const arm = (d) => `<path d="${d}" fill="none" stroke="${NAVY}" stroke-width="10" stroke-linecap="round"/>`

const POSES = {
  // left arm relaxed in every pose; the right arm tells the story
  wave: { right: `${arm('M188 150 Q214 128 216 92')}${glove(216, 86)}<path d="M232 70 q8 6 6 16 M240 60 q12 10 9 26" fill="none" stroke="${SKY}" stroke-width="3" stroke-linecap="round"/>`, mouth: 'smile', brows: 'up' },
  point: { right: `${arm('M188 150 Q218 146 236 138')}${glove(240, 136)}<path d="M248 133 l14 -5" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`, mouth: 'smile', brows: 'up', look: 6 },
  check: { right: `<g transform="rotate(-8 214 168)"><rect x="196" y="138" width="44" height="56" rx="6" fill="${WHITE}" stroke="${INK}" stroke-width="3"/><rect x="208" y="132" width="20" height="10" rx="3" fill="${STEEL}" stroke="${INK}" stroke-width="2.5"/><path d="M206 160 l7 7 l14 -15" fill="none" stroke="#138A52" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M206 180 h26" stroke="${STEEL}" stroke-width="3" stroke-linecap="round"/></g>${arm('M188 152 Q196 166 204 170')}${glove(206, 172, 10)}`, mouth: 'grin', brows: 'up' },
  stop: { right: `${arm('M188 148 Q222 140 228 112')}<g transform="translate(228 96)"><rect x="-15" y="-18" width="30" height="34" rx="12" fill="${WHITE}" stroke="${INK}" stroke-width="3"/><path d="M-8 -16 v-8 M0 -18 v-9 M8 -16 v-8" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>`, mouth: 'flat', brows: 'flat' },
}

export const MASCOT_POSES = Object.keys(POSES)

/** SVG markup for Torq. pose: wave | point | check | stop. */
export function mascotSvg(pose = 'wave', { size = 240, title = 'Torq, the Torque Stripe guide' } = {}) {
  const P = POSES[pose] || POSES.wave, cx = 120, cy = 128, R = 78, look = P.look || 0
  const mouth = {
    smile: `<path d="M106 156 q14 13 28 0" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`,
    grin: `<path d="M104 152 q16 20 32 0 z" fill="${INK}"/><path d="M110 158 q10 6 20 0" fill="none" stroke="#FF8A7A" stroke-width="4" stroke-linecap="round"/>`,
    flat: `<path d="M107 158 h26" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`,
  }[P.mouth]
  const brows = P.brows === 'flat'
    ? `<path d="M90 106 l18 4 M150 106 l-18 4" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
    : `<path d="M90 104 q9 -6 18 -1 M132 103 q9 -5 18 1" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 270 270" width="${size}" height="${size}" role="img" aria-label="${title}">
  <title>${title}</title>
  <defs>
    <clipPath id="torq-body-${pose}"><polygon points="${HEX(cx, cy, R)}"/></clipPath>
    <linearGradient id="torq-face-${pose}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NAVY2}"/><stop offset="1" stop-color="${NAVY}"/></linearGradient>
  </defs>
  <ellipse cx="120" cy="252" rx="78" ry="9" fill="${INK}" opacity=".12"/>
  <!-- washer (the seat the stripe continues onto) -->
  <ellipse cx="120" cy="236" rx="70" ry="15" fill="${STEEL}" stroke="${INK}" stroke-width="3"/>
  <ellipse cx="120" cy="233" rx="30" ry="6" fill="#E9EEF5"/>
  <path d="M148 230 l14 10" stroke="${SKY}" stroke-width="10" stroke-linecap="butt"/>
  <!-- legs -->
  <path d="M100 196 v26 M140 196 v26" stroke="${NAVY}" stroke-width="12" stroke-linecap="round"/>
  <!-- left arm (relaxed) -->
  ${arm('M54 150 Q32 168 36 194')}${glove(36, 198)}
  <!-- body: hex bolt head -->
  <polygon points="${HEX(cx, cy, R)}" fill="url(#torq-face-${pose})" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <polygon points="${HEX(cx, cy - 4, R - 14)}" fill="none" stroke="${WHITE}" stroke-opacity=".14" stroke-width="3" stroke-linejoin="round"/>
  <!-- torque stripe sash, broken at the edge like the logo -->
  <g clip-path="url(#torq-body-${pose})"><rect x="128" y="20" width="22" height="230" fill="${SKY}" transform="rotate(32 139 135)"/><rect x="128" y="20" width="6" height="230" fill="${SKY2}" opacity=".6" transform="rotate(32 139 135)"/></g>
  <polygon points="${HEX(cx, cy, R)}" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <!-- face plate -->
  <rect x="78" y="94" width="84" height="76" rx="30" fill="#F4F8FC"/>
  ${brows}
  <ellipse cx="${100 + look}" cy="124" rx="9" ry="11" fill="${INK}"/><circle cx="${103 + look}" cy="120" r="3.2" fill="${WHITE}"/>
  <ellipse cx="${140 + look}" cy="124" rx="9" ry="11" fill="${INK}"/><circle cx="${143 + look}" cy="120" r="3.2" fill="${WHITE}"/>
  <circle cx="88" cy="146" r="6" fill="${SKY2}" opacity=".45"/><circle cx="152" cy="146" r="6" fill="${SKY2}" opacity=".45"/>
  ${mouth}
  <!-- ground-crew headset -->
  <path d="M60 104 Q120 22 180 104" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
  <path d="M60 104 Q120 22 180 104" fill="none" stroke="${SKY}" stroke-width="4" stroke-linecap="round"/>
  <rect x="44" y="96" width="24" height="40" rx="11" fill="${WHITE}" stroke="${INK}" stroke-width="3.5"/>
  <rect x="172" y="96" width="24" height="40" rx="11" fill="${WHITE}" stroke="${INK}" stroke-width="3.5"/>
  <rect x="49" y="106" width="14" height="20" rx="6" fill="${AMBER}"/>
  <rect x="177" y="106" width="14" height="20" rx="6" fill="${AMBER}"/>
  <!-- right arm by pose -->
  ${P.right}
</svg>`
}
