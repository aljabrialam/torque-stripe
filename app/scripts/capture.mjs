// Captures real app states (full screen + individual panels) for the films. Usage: node scripts/capture.mjs [baseUrl]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.argv[2] || 'http://localhost:5173', out = new URL('../film/plates/', import.meta.url).pathname
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] })
const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 })
// Panel plates are shot with the background stage hidden so the 3D doesn't show through the glass twice in the film.
const stageVis = v => p.evaluate(v => { document.querySelector('.stage-host').style.visibility = v }, v)
const shot = async (name, loc) => {
  if (loc) { await stageVis('hidden'); await p.waitForTimeout(60); await loc.screenshot({ path: `${out}${name}.jpg`, quality: 90, type: 'jpeg' }); await stageVis('visible') }
  else await p.screenshot({ path: `${out}${name}.jpg`, quality: 90, type: 'jpeg' })
}
const top = () => p.locator('#ask').evaluate(e => e.scrollTo(0, 0))
async function ask(model, q) {
  await top(); await p.fill('.ab-model input', model); await p.fill('.ab-q input', q)
  await p.click('.askbar button[type=submit]'); await p.waitForTimeout(1600)
}
async function answerShots(name) {
  await shot(`${name}-console`)
  await shot(`${name}-checks`, p.locator('.hud.left')); await shot(`${name}-proposal`, p.locator('.hud.right'))
  await shot(`${name}-card`, p.locator('.card.ans'))
  if (await p.locator('.sources').count()) await shot(`${name}-sources`, p.locator('.sources'))
}
await p.goto(base + '/?notour#/ask'); await p.waitForTimeout(2000)
await shot('idle-console'); await shot('idle-radar', p.locator('.hud.br')); await shot('askbar', p.locator('.askbar'))
await ask('AS350B3', 'main rotor servo-control torque inspection'); await answerShots('servo');
await p.locator('text=Export PDF').click(); await p.waitForTimeout(150)
{ const html = await p.evaluate(() => document.querySelector('iframe').contentDocument.documentElement.outerHTML)
  const q = await b.newPage({ viewport: { width: 820, height: 1160 }, deviceScaleFactor: 2 }); await q.setContent(html); await q.waitForTimeout(200)
  const h = await q.evaluate(() => document.body.scrollHeight)
  await q.screenshot({ path: `${out}report-top.jpg`, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 820, height: 1000 } })
  await q.screenshot({ path: `${out}report-bottom.jpg`, type: 'jpeg', quality: 92, clip: { x: 0, y: Math.max(0, h - 1000), width: 820, height: 1000 }, fullPage: true })
  await q.close() } await shot('servo-radar', p.locator('.hud.br')); await shot('servo-legend', p.locator('.hud.bc'))
await ask('AS350B', 'What does FAA-2026-11800 require?'); await answerShots('b-listed')
await ask('AS350B3', 'What does FAA-2026-11800 require?'); await answerShots('b3-na')
await ask('', 'Status of FAA-2026-1338'); await answerShots('revision')
await ask('', 'Is FAA-2013-0541 still active?'); await answerShots('withdrawn')
await ask('', 'Does FAA-2026-1335 apply to my 787?'); await answerShots('variant')
await ask('787-9', 'Does FAA-2026-1335 apply to my 787-9?'); await answerShots('unconfirmed')
await ask('A380-841', 'What is the torque for the A380-841 landing gear?'); await answerShots('refused')
for (const v of ['fleet', 'insights', 'eval']) {
  await p.click(`[data-tab="${v}"]`); await p.waitForTimeout(v === 'eval' ? 3000 : 1500); await shot(`${v}-page`)
}
await shot('eval-metrics', p.locator('.metrics'))
await shot('eval-fails', p.locator('.fails'))
await p.click('[data-tab="insights"]'); await p.waitForTimeout(800); await shot('insights-land', p.locator('.ins-land'))
await b.close(); console.log('captured to', out)
