// Narration for a film script, measured line by line -> film/audio/<film>-timeline.json + <film>-narration.wav
// Usage: node scripts/narrate.mjs [demo|brief] [voice] [rate]
//   brief/default voice: edge-tts en-PH-RosaNeural at -8% (pip install edge-tts; uses ../.venv/bin/edge-tts if present)
//   voice "say:<Name>" uses macOS say instead, e.g. say:Samantha
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
const root = new URL('..', import.meta.url).pathname, dir = `${root}film/audio/`
mkdirSync(dir, { recursive: true })
const film = process.argv[2] || 'brief', voice = process.argv[3] || 'en-PH-RosaNeural', rate = process.argv[4] || '-8%'
const script = JSON.parse(readFileSync(`${root}src/film/${film}-script.json`, 'utf8'))
const edge = existsSync(`${root}../.venv/bin/edge-tts`) ? `${root}../.venv/bin/edge-tts` : 'edge-tts'
const dur = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim()
let t = 0.8; const lines = [], list = []
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', String(t), `${dir}${film}-lead.wav`])
list.push(`file '${dir}${film}-lead.wav'`)
script.forEach((l, i) => {
  const base = `${dir}${film}-${String(i).padStart(2, '0')}`, wav = `${base}.wav`, text = l.say || l.caption
  let raw
  if (voice.startsWith('say:')) { raw = `${base}.aiff`; execFileSync('say', ['-v', voice.slice(4), '-o', raw, text]) }
  else { raw = `${base}.mp3`; execFileSync(edge, ['--voice', voice, `--rate=${rate}`, '--text', text, '--write-media', raw]) }
  const d = dur(raw), next = script[i + 1], gap = !next ? 1.2 : next.shot !== l.shot ? 0.8 : 0.35
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-ar', '44100', '-ac', '1', '-af', `apad=pad_dur=${gap}`, wav])
  lines.push({ ...l, start: +t.toFixed(3), dur: +(dur(wav)).toFixed(3) }); t += dur(wav)
  list.push(`file '${wav}'`)
})
writeFileSync(`${dir}${film}-list.txt`, list.join('\n'))
const narration = film === 'demo' ? `${dir}narration.wav` : `${dir}${film}-narration.wav`
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${dir}${film}-list.txt`, '-c:a', 'pcm_s16le', narration])
writeFileSync(`${dir}${film}-timeline.json`, JSON.stringify(lines, null, 1))
console.log(`${film}: ${lines.length} lines, ${t.toFixed(1)} s of narration (${voice})`)
