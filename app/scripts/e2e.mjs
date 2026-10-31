// End-to-end test of the React app, driven like a user. Usage: node scripts/e2e.mjs [baseUrl] [chromium|webkit|all]
// Expected outcomes come from the rule engine on the real dataset; the test checks what is on screen, not internals.
import { chromium, webkit } from '@playwright/test'
const base = process.argv[2] || 'http://localhost:5173', which = process.argv[3] || 'all'
const browsers = which === 'all' ? [['chromium', chromium], ['webkit', webkit]] : [[which, which === 'webkit' ? webkit : chromium]]
const results = []
let failed = 0

async function suite(name, B) {
  const browser = await B.launch()
  const errors = [], bad = []
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  p.on('pageerror', e => errors.push(e.message))
  p.on('console', m => m.type() === 'error' && errors.push(m.text()))
  p.on('response', r => r.status() >= 400 && !r.url().includes('_vercel') && bad.push(`${r.status()} ${r.url()}`))
  const t = async (label, fn) => {
    try { await fn(); results.push([name, 'PASS', label]) } catch (e) { failed++; results.push([name, 'FAIL', `${label}: ${e.message.split('\n')[0]}`]) }
  }
  const expect = (c, msg) => { if (!c) throw new Error(msg) }
  const text = loc => loc.innerText()
  const top = () => p.locator('#ask').evaluate(e => e.scrollTo(0, 0))
  const answer = () => p.locator('#answer .card.ans')
  async function askTyped(model, q) {
    await top(); await p.fill('.ab-model input', model); await p.fill('.ab-q input', q); await p.press('.ab-q input', 'Enter')
    await p.waitForFunction(() => !document.querySelector('.askbar button[disabled]')); await p.waitForTimeout(250)
  }
  const chip = async label => { await top(); await p.locator('.chip', { hasText: label }).first().click(); await p.waitForTimeout(500) }

  await t('first visit shows the guided tour, which steps through and closes', async () => {
    await p.goto(base + '/#/ask'); await p.waitForSelector('.tour-card', { timeout: 15000 })
    let steps = 0
    while (await p.locator('.tour-card').count()) {
      const btn = p.locator('.tour-card .glass-btn.pri'); const last = (await text(btn)) === 'Start'
      await btn.click(); steps++; await p.waitForTimeout(150); if (last || steps > 12) break
    }
    expect(steps >= 7, `only ${steps} tour steps`); expect(!(await p.locator('.tour-card').count()), 'tour still open')
  })
  await t('tour stays closed on a repeat visit (same browser)', async () => {
    await p.goto(base + '/#/ask'); await p.waitForTimeout(1200); expect(!(await p.locator('.tour-card').count()), 'tour shown again')
  })
  await t('header shows the real dataset counts', async () => {
    const h = await text(p.locator('.topbar')); expect(/431 notices/i.test(h) && /323 dockets/i.test(h) && /1,302/.test(h), h)
  })
  await t('typed question + Enter answers with citations', async () => {
    await askTyped('AS350B3', 'main rotor servo-control torque inspection')
    const a = await text(answer())
    expect(/Answered/.test(a) && /FAA-2026-11814/.test(a) && /Proposed for all AS350B3 units/.test(a), a.slice(0, 200))
    expect(/not binding/i.test(a), 'missing not-binding label')
    expect(await p.locator('.sources .src').count() > 0, 'no cited sources')
    expect(/100%/.test(await text(p.locator('.hud.left'))), 'rule checks not 100%')
    expect(/Rotor system/.test(await text(p.locator('.hud.bc'))), 'affected area not shown')
  })
  await t('citation chip highlights its source sentence', async () => {
    await p.locator('.cite').first().click(); expect(await p.locator('.src.cur').count() === 1, 'no highlighted source')
  })
  const cases = [
    ['Any proposed ADs for AS350B3?', /3 proposals list AS350B3/, null],
    ['What does FAA-2026-11800 require?', /Proposed for all AS350B units/, 'AS350B'],
    ['Status of FAA-2026-1338', /About FAA-2026-1338/, null],
    ['still active', /FAA-2013-0541 was withdrawn/, null],
    ['apply to my 787?', /Which 787 variant\?/, null],
    ['apply to my 787-9?', /787-9 is listed, but only certain units are covered/, null],
    ['supersedes AD 2026-09-02', /FAA-2026-11811/, null],
    ['A380-841', /I can't answer that from this data/, null],
  ]
  for (const [label, rx, model] of cases) await t(`demo question: ${label}`, async () => {
    if (model) { await top(); await p.locator('.chip', { hasText: label }).filter({ hasText: model }).filter({ hasNotText: model + '3' }).first().click(); await p.waitForTimeout(500) }
    else await chip(label)
    const a = await text(answer()); expect(rx.test(a), a.slice(0, 160))
  })
  await t('configuration filtering: AS350B3 on FAA-2026-11800 is not applicable', async () => {
    await askTyped('AS350B3', 'What does FAA-2026-11800 require?')
    const a = await text(answer()); expect(/Not applicable/.test(a) && /AS350B3 is not covered by FAA-2026-11800/.test(a), a.slice(0, 160))
  })
  await t('refusal reason shows for an unknown model', async () => {
    await askTyped('XYZ-123', 'Any proposed ADs?'); expect(/Refused/.test(await text(answer())), 'not refused')
  })
  await t('needs-variant: picking a variant re-asks and answers', async () => {
    await askTyped('787', 'Does FAA-2026-1335 apply to my 787?')
    await p.locator('#answer .acts .glass-btn', { hasText: '787-9' }).first().click(); await p.waitForTimeout(600)
    expect(/787-9 is listed, but only certain units/.test(await text(answer())), 'variant re-ask failed')
    expect(await p.inputValue('.ab-model input') === '787-9', 'model field not updated')
  })
  await t('list answer: clicking a candidate opens that docket', async () => {
    await askTyped('AS350B3', 'Any proposed ADs for AS350B3?')
    const d = (await text(p.locator('.cand .mono').first())).trim(); await p.locator('.cand').first().click(); await p.waitForTimeout(600)
    expect((await text(answer())).includes(d) && (await p.inputValue('.ab-q input')) === `Status of ${d}`, 'candidate did not open')
  })
  await t('camera and render controls toggle and change the 3D view', async () => {
    await askTyped('AS350B3', 'main rotor servo-control torque inspection')
    const shot = () => p.locator('.stage-host canvas').screenshot()
    await p.locator('.views .glass-btn', { hasText: 'Wire' }).click(); await p.waitForTimeout(400); const wire = await shot()
    await p.locator('.views .glass-btn', { hasText: 'Render' }).click(); await p.waitForTimeout(400); const solid = await shot()
    expect(!wire.equals(solid), 'render and wire look identical')
    for (const v of ['Top', 'Side', '3D']) { const b = p.locator('.views .glass-btn', { hasText: new RegExp(`^${v}$`) }); await b.click(); expect(await b.getAttribute('aria-pressed') === 'true', `${v} not pressed`) }
  })
  await t('Export PDF builds a fingerprinted report with sign-off', async () => {
    await p.locator('text=Export PDF').click(); await p.waitForTimeout(150)
    const html = await p.evaluate(() => document.querySelector('iframe')?.contentDocument?.documentElement.outerHTML || '')
    expect(/FAA-2026-11814/.test(html) && /SHA-256 [0-9a-f]{64}/.test(html) && /Licence \/ authorisation number/.test(html), 'report content missing')
    const q = await browser.newPage(); await q.setContent(html)
    if (name === 'chromium') { const pdf = await q.pdf({ format: 'A4' }); expect(pdf.length > 20000, `pdf only ${pdf.length} bytes`) }
    await q.close()
  })
  await t('comment radar opens an open proposal', async () => {
    await askTyped('AS350B3', 'Any proposed ADs for AS350B3?')
    const btn = p.locator('.radar-l .glass-btn'); const d = (await text(btn)).trim(); await btn.click(); await p.waitForTimeout(600)
    expect((await text(answer())).includes(d), 'radar did not open docket')
  })
  await t('Fleet: sample fleet, filtering, withdrawn toggle, open a docket', async () => {
    await p.click('[data-tab="fleet"]'); await p.waitForSelector('.fleet-card')
    expect(await p.locator('.fleet-card').count() === 5, 'sample fleet not 5 models')
    await p.fill('.fleet-form > input', 'A330-243'); await p.click('text=Check fleet'); await p.waitForTimeout(400)
    expect(await p.locator('.fleet-card').count() === 1, 'fleet filter failed')
    const before = await p.locator('.fc-list li').count(); await p.check('.tog input'); await p.waitForTimeout(200)
    expect(await p.locator('.fc-list li').count() >= before, 'withdrawn toggle broke list')
    const d = (await text(p.locator('.fc-list b').first())).trim(); await p.locator('.fc-list button').first().click(); await p.waitForTimeout(700)
expect((await text(answer())).includes(d), 'fleet docket did not open in Ask')
  })
  await t('Insights: maker filter, bar drill-down, clear', async () => {
    await p.click('[data-tab="insights"]'); await p.waitForSelector('.makers button')
    const all = await text(p.locator('.ins-land .ph .meta')); await p.locator('.makers button').first().click(); await p.waitForTimeout(200)
    expect(all !== await text(p.locator('.ins-land .ph .meta')), 'maker filter did nothing')
    await p.locator('.makers button').first().click()
    await p.locator('.land-cell:not([disabled])').first().click(); await p.waitForTimeout(200)
    expect(await p.locator('.land-list .cand').count() > 0, 'bar drill-down empty')
    await p.click('text=Clear'); expect(!(await p.locator('.land-list').count()), 'clear failed')
  })
  await t('Evaluation runs live: 42/42 correct, 0/16 unsafe, 6/6 withdrawn, 4 known failures', async () => {
    await p.click('[data-tab="eval"]'); await p.waitForSelector('.metric .readout', { timeout: 20000 })
    const r = (await p.locator('.metric .readout').allInnerTexts()).map(s => s.replace(/\s/g, ''))
    expect(r[0] === '42/42' && r[1] === '0/16' && r[2] === '6/6', r.join(' '))
    expect(await p.locator('.fail').count() === 4 && await p.locator('.evtab tbody tr').count() === 42, 'failures/table count')
    await p.click('text=Run evaluation again'); await p.waitForTimeout(1500)
    expect((await p.locator('.metric .readout').first().innerText()).replace(/\s/g, '') === '42/42', 'rerun changed result')
  })
  await t('deep link to #/eval and back button work', async () => {
    await p.goto(base + '/#/fleet'); await p.waitForSelector('.fleet-card'); await p.goto(base + '/#/eval'); await p.waitForSelector('.metric')
    await p.goBack(); await p.waitForSelector('.fleet-card', { timeout: 5000 })
  })
  await t('keyboard only: tab to the question, type, Enter', async () => {
    await p.goto(base + '/#/ask'); await p.waitForTimeout(800)
    await p.focus('.ab-model input'); await p.keyboard.press('Tab'); await p.keyboard.type('Is FAA-2013-0541 still active?'); await p.keyboard.press('Enter'); await p.waitForTimeout(700)
    expect(/withdrawn/.test(await text(answer())), 'keyboard ask failed')
  })
  await t('profile card links to LinkedIn', async () => {
    const href = await p.locator('.rail-me').getAttribute('href'); expect(href === 'https://www.linkedin.com/in/aljabri-alam/', href)
    expect(await p.locator('.rail-me img').evaluate(i => i.naturalWidth > 0), 'photo did not load')
  })
  await ctx.close()

  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: name === 'chromium', hasTouch: true })
  const mp = await m.newPage(); mp.on('pageerror', e => errors.push('mobile: ' + e.message))
  await t('mobile: ask via a demo question and switch views', async () => {
    await mp.goto(base + '/?notour#/ask'); await mp.waitForTimeout(1500)
    await mp.locator('.chip', { hasText: 'still active' }).tap(); await mp.waitForTimeout(700)
    expect(/withdrawn/.test(await mp.locator('#answer').innerText()), 'mobile answer')
    await mp.locator('[data-tab="eval"]').tap(); await mp.waitForSelector('.metric .readout', { timeout: 20000 })
    const w = await mp.evaluate(() => document.documentElement.scrollWidth); expect(w <= 392, `horizontal overflow ${w}px`)
    const lay = await mp.evaluate(() => {
      const box = s => { const e = document.querySelector(s); if (!e || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right } }
      return { brand: box('.tb-item.brand'), airbus: box('.tb-airbus'), ds: box('.tb-item.ds') }
    })
    expect(lay.airbus && lay.airbus.r <= lay.brand.r + 1, 'Airbus logo spills out of the brand on mobile')
    expect(!lay.ds || lay.ds.l >= lay.airbus.r, 'Airbus logo overlaps the dataset text on mobile')
  })
  await m.close()
  await t('no console errors and no failed requests', async () => { expect(!errors.length && !bad.length, [...errors, ...bad].slice(0, 3).join(' | ')) })
  await browser.close()
}

for (const [n, B] of browsers) await suite(n, B)
for (const [b, s, l] of results) console.log(`${s === 'PASS' ? 'ok  ' : 'FAIL'} [${b}] ${l}`)
console.log(`\n${results.length - failed}/${results.length} passed`)
console.log(failed ? 'RESULT: FAILURES' : 'RESULT: ALL PASS')
process.exit(failed ? 1 : 0)
