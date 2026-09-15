let ctx: AudioContext | null = null

function audio() {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.04, delay = 0) {
  const ac = audio()
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.value = 0
  osc.connect(g)
  g.connect(ac.destination)
  const t = ac.currentTime + delay
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

export const sfx = {
  blip() {
    tone(520, 0.07, 'square', 0.03)
  },
  select() {
    tone(660, 0.08, 'square', 0.035)
    tone(880, 0.1, 'square', 0.025, 0.06)
  },
  encounter() {
    tone(220, 0.08, 'square', 0.05)
    tone(330, 0.08, 'square', 0.04, 0.08)
    tone(440, 0.12, 'square', 0.045, 0.16)
  },
  shake() {
    tone(180, 0.09, 'triangle', 0.04)
  },
  catchClick() {
    tone(880, 0.05, 'square', 0.04)
    tone(1320, 0.08, 'square', 0.035, 0.05)
  },
  catchOk() {
    tone(523, 0.1, 'square', 0.04)
    tone(659, 0.1, 'square', 0.04, 0.1)
    tone(784, 0.16, 'square', 0.045, 0.2)
  },
  catchFanfare() {
    ;[523, 659, 784, 1046, 784, 1046, 1318].forEach((freq, i) => {
      tone(freq, i === 6 ? 0.28 : 0.11, 'square', 0.046, i * 0.08)
    })
  },
  catchFail() {
    tone(196, 0.18, 'sawtooth', 0.035)
  },
  run() {
    tone(392, 0.06, 'square', 0.03)
    tone(262, 0.08, 'square', 0.03, 0.07)
  },
}
