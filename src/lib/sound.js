export class SoundEffects {
  constructor() {
    this.ctx = null
    this.muted = false
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) this.ctx = new AudioCtx()
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume()
  }

  playTone(freq, type = 'sine', duration = 0.14, vol = 0.1, slideFreq = null) {
    if (this.muted) return
    try {
      this.init()
      if (!this.ctx) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime)
      if (slideFreq) {
        osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration)
      }
      gain.gain.setValueAtTime(vol, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(this.ctx.destination)
      osc.start()
      osc.stop(this.ctx.currentTime + duration)
    } catch (e) {}
  }

  click() { this.playTone(660, 'sine', 0.07, 0.07, 920) }

  coin() {
    this.playTone(987.77, 'sine', 0.08, 0.09)
    setTimeout(() => this.playTone(1318.51, 'sine', 0.16, 0.11), 65)
  }

  countdownBeep(isGo = false) {
    if (isGo) this.playTone(880, 'triangle', 0.35, 0.18, 1320)
    else this.playTone(440, 'sine', 0.16, 0.13)
  }

  waterBoost() {
    this.playTone(240, 'sine', 0.32, 0.16, 820)
    setTimeout(() => this.playTone(540, 'triangle', 0.22, 0.11, 1020), 80)
  }

  fanfare(isWin = true) {
    const notes = isWin ? [523.25, 659.25, 783.99, 1046.5] : [392.0, 349.23, 329.63, 261.63]
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, isWin ? 'triangle' : 'sawtooth', 0.26, 0.13), idx * 105)
    })
  }
}

export const sfx = new SoundEffects()
