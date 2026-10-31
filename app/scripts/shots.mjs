// Screenshot + smoke check. Usage: node scripts/shots.mjs [baseUrl] [outDir]
import { chromium } from '@playwright/test'
const base = process.argv[2] || 'http://localhost:5173', out = process.argv[3] || '/tmp/ts-shots'
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] })
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()))
const fail = []; const expect = (c, msg) => { if (!c) fail.push(msg) }
await p.goto(base + '/?notour#/ask'); await p.waitForTimeout(1500)
await p.screenshot({ path: `${out}/01-idle.png` })
const chip = async (text) => { await p.locator('.chip', { hasText: text }).first().click(); await p.waitForTimeout(900) }
await chip('servo-control'); await p.screenshot({ path: `${out}/02-answered.png` })
expect(await p.locator('.pill', { hasText: 'Answered' }).count() > 0, 'servo: answered')
expect(await p.locator('.pill', { hasText: 'FAA-2026-11814' }).count() > 0, 'servo: docket')
await p.screenshot({ path: `${out}/03-answer-full.png`, fullPage: false, clip: undefined })
await p.locator('#answer').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({ path: `${out}/03b-answer.png` })
await p.locator('#ask').evaluate(e => e.scrollTo(0, 0))
await chip('still active'); expect(await p.locator('.headline', { hasText: 'withdrawn' }).count() > 0, 'withdrawn'); await p.screenshot({ path: `${out}/04-withdrawn.png` })
await chip('A380-841'); expect(await p.locator('.pill', { hasText: 'Refused' }).count() > 0, 'refused'); await p.screenshot({ path: `${out}/05-refused.png` })
await chip('apply to my 787?'); expect(await p.locator('.headline', { hasText: 'variant' }).count() > 0, 'needs variant')
await p.locator('#ask').evaluate(e => e.scrollTo(0, 0))
for (const v of ['fleet', 'insights', 'eval']) {
  await p.click(`[data-tab="${v}"]`); await p.waitForTimeout(v === 'eval' ? 2500 : 1000); await p.screenshot({ path: `${out}/06-${v}.png` })
}
expect(await p.locator('.metric .readout').first().innerText().then(t => t.replace(/\s/g, '')).catch(() => '') === '42/42', 'eval 42/42')
expect((await p.locator('.metric .readout').nth(1).innerText()).replace(/\s/g, '') === '0/16', 'eval 0/16')
const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })
await m.goto(base + '/?notour#/ask'); await m.waitForTimeout(1200); await m.screenshot({ path: `${out}/07-mobile.png` })
await b.close()
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors')
console.log(fail.length ? 'FAIL: ' + fail.join(', ') : 'RESULT: ALL PASS')
process.exit(fail.length || errs.length ? 1 : 0)
