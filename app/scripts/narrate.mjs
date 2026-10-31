// Generates the demo narration with macOS `say`, measures each line and writes film/audio/demo-timeline.json + narration.wav.
// Usage: node scripts/narrate.mjs [voice] [rate]
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
const root = new URL('..', import.meta.url).pathname, dir = `${root}film/audio/`
mkdirSync(dir, { recursive: true })
const voice = process.argv[2] || 'Samantha', rate = process.argv[3] || '178'
const script = JSON.parse(readFileSync(`${root}src/film/demo-script.json`, 'utf8'))
const dur = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim()
let t = 0.8; const lines = [], list = []
writeFileSync(`${dir}lead.wav`, ''); execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', String(t), `${dir}lead.wav`])
list.push(`file '${dir}lead.wav'`)
script.forEach((l, i) => {
  const aiff = `${dir}${String(i).padStart(2, '0')}.aiff`, wav = aiff.replace('.aiff', '.wav')
  execFileSync('say', ['-v', voice, '-r', rate, '-o', aiff, l.say || l.caption])
  const d = dur(aiff), next = script[i + 1], gap = !next ? 1.2 : next.shot !== l.shot ? 0.85 : 0.4
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', aiff, '-ar', '44100', '-ac', '1', '-af', `apad=pad_dur=${gap}`, wav])
  lines.push({ ...l, start: +t.toFixed(3), dur: +(d + gap).toFixed(3) }); t += d + gap
  list.push(`file '${wav}'`)
})
writeFileSync(`${dir}list.txt`, list.join('\n'))
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${dir}list.txt`, '-c:a', 'pcm_s16le', `${dir}narration.wav`])
writeFileSync(`${dir}demo-timeline.json`, JSON.stringify(lines, null, 1))
console.log(`${lines.length} lines, ${t.toFixed(1)} s of narration`)
