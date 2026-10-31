"""Original uplifting aviation score, synthesised from scratch (no samples, no licences needed).
Usage: python scripts/music.py <seconds> <out.wav>
D major, 104 BPM, I-V-vi-IV. Arrangement scales to the requested length:
cabin chime + wind -> pads -> arpeggio -> bass, kick and shaker -> breakdown -> final lift -> outro.
"""
import sys, wave
import numpy as np

SR, BPM = 44100, 104
BEAT = 60 / BPM; BAR = 4 * BEAT
rng = np.random.default_rng(7)
length = float(sys.argv[1]); out = sys.argv[2]
N = int((length + 1.0) * SR)
L = np.zeros(N); R = np.zeros(N); WET = np.zeros((2, N))

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def env_adsr(n, a, d, s, r):
    t = np.arange(n) / SR; e = np.ones(n) * s
    ai, di, ri = int(a * SR), int(d * SR), int(r * SR)
    e[:ai] = np.linspace(0, 1, max(ai, 1))[:len(e[:ai])]
    e[ai:ai + di] = np.linspace(1, s, max(di, 1))[:len(e[ai:ai + di])]
    if ri: e[-ri:] *= np.linspace(1, 0, ri)
    return e
def add(sig, start, gain=1.0, pan=0.0, wet=0.0):
    i = int(start * SR); j = min(N, i + len(sig))
    if i >= N or j <= i: return
    s = sig[: j - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:j] += s * l; R[i:j] += s * r
    if wet: WET[0, i:j] += s * l * wet; WET[1, i:j] += s * r * wet

def tone(f, dur, harmonics=(1,), detune=0.0):
    t = np.arange(int(dur * SR)) / SR
    return sum(w * np.sin(2 * np.pi * f * k * (1 + detune) * t + rng.uniform(0, 6.28)) for k, w in harmonics)

# chords: D A Bm G  (root midi, triad + colour tones)
PROG = [(50, [62, 66, 69, 74]), (45, [61, 64, 69, 73]), (47, [62, 66, 71, 74]), (43, [62, 67, 71, 74])]
bars = int(np.ceil(length / BAR))
def section(b):
    f = b / bars
    if b < 4: return 'intro'
    if b < 8: return 'build'
    if 0.52 < f < 0.64: return 'break'
    if f > 0.92 or b >= bars - 2: return 'outro'
    if f > 0.64: return 'lift'
    return 'main'

# cabin chime (high-low, like the seatbelt sign) and airy wind
for i, m in enumerate((81, 76)):
    t = np.arange(int(2.6 * SR)) / SR
    add((np.sin(2 * np.pi * hz(m) * t) + .25 * np.sin(2 * np.pi * hz(m) * 2.01 * t)) * np.exp(-t * 2.2), 0.4 + i * 0.75, .22, -.2 + .4 * i, .5)
wind = rng.standard_normal(N); 
for _ in range(3): wind = np.convolve(wind, np.ones(24) / 24, mode='same')
wind *= (0.55 + 0.45 * np.sin(2 * np.pi * np.arange(N) / SR / 9.0)) * .5
wind[: int(BAR * 6 * SR)] *= np.linspace(1, .35, int(BAR * 6 * SR)); wind[int(BAR * 6 * SR):] *= .35
L += wind * .9; R += np.roll(wind, 900) * .9

for b in range(bars):
    sec = section(b); root, notes = PROG[b % 4]; t0 = b * BAR
    lvl = {'intro': .6, 'build': .8, 'main': .85, 'break': .9, 'lift': 1, 'outro': .7}[sec]
    # pads: soft detuned additive voices, long attack, overlapping bars
    for m in notes:
        for dt, pan in ((-.0025, -.6), (.0025, .6)):
            sig = tone(hz(m), BAR + 1.2, ((1, 1), (2, .35), (3, .18), (4, .08)), dt) * env_adsr(int((BAR + 1.2) * SR), .9, .4, .8, 1.2)
            add(sig, t0, .035 * lvl, pan, .55)
    if sec in ('build', 'main', 'lift', 'break'):
        # arpeggio: 8th notes over two octaves, plucked, with echo
        pattern = [notes[0], notes[1], notes[2], notes[3], notes[2] + 12, notes[3], notes[1] + 12, notes[2]]
        for k, m in enumerate(pattern):
            t = np.arange(int(.5 * SR)) / SR
            pl = (np.sin(2 * np.pi * hz(m + 12) * t) + .3 * np.sin(2 * np.pi * hz(m + 12) * 2 * t)) * np.exp(-t * 9)
            g = .07 * (.6 if sec == 'build' else 1) * (.75 if sec == 'break' else 1)
            add(pl, t0 + k * BEAT / 2, g, -.35 if k % 2 else .35, .35)
            add(pl, t0 + k * BEAT / 2 + .75 * BEAT, g * .35, .35 if k % 2 else -.35, .5)
    if sec in ('main', 'lift'):
        for q in range(4):  # bass, kick, shaker
            t = np.arange(int(BEAT * SR)) / SR
            bass = np.tanh(2.2 * np.sin(2 * np.pi * hz(root) * t)) * np.exp(-t * 2.8)
            add(bass, t0 + q * BEAT, .11)
            kt = np.arange(int(.35 * SR)) / SR
            kick = np.sin(2 * np.pi * (45 * kt + (120 - 45) / 18 * (1 - np.exp(-kt * 18)))) * np.exp(-kt * 9)
            add(kick, t0 + q * BEAT, .22 if sec == 'lift' else .17)
            sh = np.convolve(np.diff(rng.standard_normal(int(.09 * SR) + 1)), np.ones(3) / 3, mode='same') * np.exp(-np.arange(int(.09 * SR)) / SR * 55)
            add(sh, t0 + q * BEAT + BEAT / 2, .012, .3)
            if sec == 'lift': add(sh, t0 + q * BEAT + BEAT / 4, .006, -.3)
    if sec == 'lift' and b % 8 == 0:  # bright bell motif at each lift phrase
        for k, m in enumerate((81, 78, 83, 81)):
            t = np.arange(int(1.8 * SR)) / SR
            add(np.sin(2 * np.pi * hz(m) * t) * np.exp(-t * 2.5), t0 + k * BEAT, .06, .2, .6)
    nxt = section(b + 1) if b + 1 < bars else 'end'
    if nxt in ('main', 'lift') and sec not in ('main', 'lift'):  # riser into the drop
        n = int(BAR * SR); ramp = np.linspace(0, 1, n) ** 2
        noise = rng.standard_normal(n); noise = np.convolve(noise, np.ones(6) / 6, mode='same')
        add((noise * .5 + np.sin(2 * np.pi * np.cumsum(np.linspace(200, 900, n)) / SR) * .3) * ramp, t0, .05, 0, .4)

# reverb on the wet bus: FFT convolution with a 2.4 s decaying stereo noise tail
irn = int(2.4 * SR); tt = np.arange(irn) / SR
for c, out_ch in ((0, L), (1, R)):
    ir = rng.standard_normal(irn) * np.exp(-tt * 2.6); ir[:int(.02 * SR)] = 0
    n2 = 1 << int(np.ceil(np.log2(N + irn)))
    out_ch += np.fft.irfft(np.fft.rfft(WET[c], n2) * np.fft.rfft(ir, n2), n2)[:N] * .05

mix = np.stack([L, R])
fade = int(3.5 * SR); mix[:, -fade:] *= np.linspace(1, 0, fade); mix[:, :int(.05 * SR)] *= np.linspace(0, 1, int(.05 * SR))
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.15) * .89
pcm = (mix.T * 32767).astype(np.int16)
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f'{out}: {length:.1f}s, {bars} bars at {BPM} BPM')
