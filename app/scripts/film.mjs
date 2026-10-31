// Renders /film.html frame by frame (deterministic seek) and encodes an H.264 MP4 with a synthesized ambient score.
// Usage: node scripts/film.mjs teaser|demo [fps] [baseUrl]
import { chromium } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, existsSync } from 'node:fs'
const args = process.argv.slice(2).filter(a => !a.startsWith('--'))
const film = args[0] || 'teaser', fps = +(args[1] || 30), base = args[2] || 'http://localhost:5173'
const root = new URL('..', import.meta.url).pathname, outDir = `${root}film/out/`
mkdirSync(outDir, { recursive: true })

const audioOnly = process.argv.includes('--audio-only')   // re-mix audio onto an existing silent render
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--force-device-scale-factor=1'] })
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
p.on('pageerror', e => console.error('pageerror', e.message))
await p.goto(`${base}/film.html?film=${film}`)
await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 })
const length = await p.evaluate(() => window.__length)
const frames = Math.ceil(length * fps)
console.log(`${film}: ${length.toFixed(1)} s, ${frames} frames at ${fps} fps`)

const silent = `${outDir}${film}-silent.mp4`
const t0 = Date.now()
if (!audioOnly) {
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] })
for (let i = 0; i < frames; i++) {
  await p.evaluate(t => window.__seek(t), i / fps)
  const buf = await p.screenshot({ type: 'jpeg', quality: 92 })
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r))
  if (i % (fps * 5) === 0) process.stdout.write(`  ${(i / fps).toFixed(0)}s (${((Date.now() - t0) / 1000).toFixed(0)}s elapsed)\n`)
}
ff.stdin.end(); await new Promise(r => ff.on('close', r))
}
await b.close()

// ambient score: detuned drone in D, slow tremolo, soft pink-noise air, long echo tail
const L = length.toFixed(2), music = `${outDir}${film}-score.wav`
const tones = [73.42, 110, 146.83, 220.5, 293.66].map(f => `sine=f=${f}:d=${L}`)
execFileSync('ffmpeg', ['-v', 'error', '-y', ...tones.flatMap(s => ['-f', 'lavfi', '-i', s]), '-f', 'lavfi', '-i', `anoisesrc=c=pink:a=0.06:d=${L}`, '-filter_complex',
  `[0]volume=0.55[a0];[1]volume=0.35,tremolo=f=0.11:d=0.6[a1];[2]volume=0.28,tremolo=f=0.17:d=0.5[a2];[3]volume=0.12,tremolo=f=0.23:d=0.7[a3];[4]volume=0.06,tremolo=f=0.13:d=0.9[a4];[5]lowpass=f=900,volume=0.5[n];` +
  `[a0][a1][a2][a3][a4][n]amix=inputs=6:normalize=0,lowpass=f=2400,aecho=0.8:0.7:900|1700:0.35|0.22,volume=0.5,afade=t=in:d=2.5,afade=t=out:st=${Math.max(0, length - 3).toFixed(2)}:d=3[m]`,
  '-map', '[m]', '-ar', '44100', '-ac', '2', music])

const final = `${outDir}torque-stripe-${film}.mp4`, narration = film === 'demo' ? `${root}film/audio/narration.wav` : `${root}film/audio/${film}-narration.wav`
const audioArgs = film !== 'teaser' && existsSync(narration)
  ? ['-i', music, '-i', narration, '-filter_complex', '[1]volume=0.22[m];[2]aformat=channel_layouts=stereo,volume=1.6[v];[m][v]amix=inputs=2:normalize=0:duration=first[a]', '-map', '0:v', '-map', '[a]']
  : ['-i', music, '-map', '0:v', '-map', '1:a']
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', silent, ...audioArgs, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final])
console.log('wrote', final, `in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
