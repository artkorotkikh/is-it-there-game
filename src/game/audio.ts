import type { InputFrame, Snapshot } from './types';

const noteFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(context: BaseAudioContext) {
  let buffer = noiseBuffers.get(context);
  if (!buffer) {
    buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 911;
    for (let i = 0; i < data.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
    noiseBuffers.set(context, buffer);
  }
  return buffer;
}

function tone(context: BaseAudioContext, destination: AudioNode, frequency: number, time: number, duration: number, volume: number, type: OscillatorType = 'triangle', endFrequency = frequency) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, time);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), time + duration);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume, time + .008);
  gain.gain.exponentialRampToValueAtTime(.00001, time + duration);
  oscillator.connect(gain).connect(destination);
  oscillator.start(time); oscillator.stop(time + duration + .02);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}

function rustle(context: BaseAudioContext, destination: AudioNode, time: number, duration: number, volume: number, frequency: number) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = noiseBuffer(context);
  filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = .6;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume, time + .005);
  gain.gain.exponentialRampToValueAtTime(.00001, time + duration);
  source.connect(filter).connect(gain).connect(destination);
  source.start(time); source.stop(time + duration + .02);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
}

/** Karplus–Strong string: original generated samples, no external recording. */
function pluck(context: BaseAudioContext, destination: AudioNode, midi: number, time: number, volume: number, duration = .75) {
  const frequency = noteFrequency(midi);
  const period = Math.round(context.sampleRate / frequency);
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = midi * 137 + 19;
  for (let i = 0; i < period; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; data[i] = (seed / 2147483648 - 1) * .7; }
  for (let i = period; i < data.length; i++) data[i] = .498 * (data[i - period] + data[i - period + 1]);
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = 'lowpass'; filter.frequency.value = 3600;
  gain.gain.setValueAtTime(volume, time);
  gain.gain.setTargetAtTime(0, time + duration * .65, duration * .1);
  source.connect(filter).connect(gain).connect(destination);
  source.start(time); source.stop(time + duration);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
}

export const BAR_SECONDS = 60 / 92 * 4;

/** Sparse road-trip strings, walking bass and brushed percussion, in D major. */
export function scheduleMusicBar(context: BaseAudioContext, destination: AudioNode, time: number, bar: number) {
  const chords = [
    { bass: 38, notes: [62, 66, 69, 74] },
    { bass: 43, notes: [62, 67, 71, 74] },
    { bass: 35, notes: [62, 66, 71, 74] },
    { bass: 45, notes: [61, 64, 69, 73] },
  ];
  const chord = chords[bar % chords.length];
  const pattern = bar % 2 ? [0, 2, 1, 3, 2, 1, 0, 2] : [0, 1, 2, 1, 3, 2, 1, 2];
  const step = BAR_SECONDS / 8;
  for (let i = 0; i < 8; i++) {
    const t = time + i * step + (i % 2 ? .023 : 0);
    pluck(context, destination, chord.notes[pattern[i]], t, i % 2 ? .48 : .64);
    rustle(context, destination, t, .07, .018, 2800);
    if (i % 2 === 0) {
      tone(context, destination, noteFrequency(chord.bass + (i === 4 ? 7 : 0)), t, .28, .19, 'sine');
      if (i === 2 || i === 6) rustle(context, destination, t, .13, .038, 1300);
    }
  }
}

export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private effects?: GainNode;
  private engine?: OscillatorNode;
  private engineGain?: GainNode;
  private motor?: OscillatorNode;
  private motorGain?: GainNode;
  private windGain?: GainNode;
  private analyser?: AnalyserNode;
  private samples = new Float32Array(512);
  private nextBar = 0;
  private bar = 0;
  private footDistance = 0;
  private previous?: Snapshot;
  private unavailable = false;
  private cargoSequence = 0;
  private nextReverseBeep = 0;
  musicEnabled = true;
  effectsEnabled = true;

  async start() {
    if (this.unavailable) return;
    try {
      // Called only from a button/key gesture; no autoplay or microphone access.
      if (!this.context) {
        const context = this.context = new AudioContext();
        this.master = context.createGain(); this.master.gain.value = .68;
        this.music = context.createGain(); this.music.gain.value = this.musicEnabled ? .28 : 0;
        this.effects = context.createGain(); this.effects.gain.value = this.effectsEnabled ? .55 : 0;
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -16; compressor.knee.value = 16; compressor.ratio.value = 4;
        this.analyser = context.createAnalyser(); this.analyser.fftSize = 512;
        this.music.connect(this.master); this.effects.connect(this.master);
        this.master.connect(compressor).connect(this.analyser).connect(context.destination);

        this.engine = context.createOscillator(); this.engine.type = 'sawtooth'; this.engine.frequency.value = 36;
        const engineFilter = context.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 260;
        this.engineGain = context.createGain(); this.engineGain.gain.value = 0;
        this.engine.connect(engineFilter).connect(this.engineGain).connect(this.effects); this.engine.start();

        this.motor = context.createOscillator(); this.motor.type = 'triangle'; this.motor.frequency.value = 220;
        this.motorGain = context.createGain(); this.motorGain.gain.value = 0;
        this.motor.connect(this.motorGain).connect(this.effects); this.motor.start();

        const wind = context.createBufferSource(); wind.buffer = noiseBuffer(context); wind.loop = true;
        const windFilter = context.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 520;
        this.windGain = context.createGain(); this.windGain.gain.value = 0;
        wind.connect(windFilter).connect(this.windGain).connect(this.effects); wind.start();
        this.nextBar = context.currentTime + .08;
      }
      await this.context.resume();
    } catch {
      // Audio support/permission failures must not break the game.
      this.unavailable = true;
    }
  }

  pause() { void this.context?.suspend().catch(() => {}); }
  reset() { this.previous = undefined; this.footDistance = 0; this.cargoSequence = 0; this.nextReverseBeep = 0; }
  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.context && this.music) this.music.gain.setTargetAtTime(this.musicEnabled ? .28 : 0, this.context.currentTime, .04);
  }
  toggleEffects() {
    this.effectsEnabled = !this.effectsEnabled;
    if (this.context && this.effects) this.effects.gain.setTargetAtTime(this.effectsEnabled ? .55 : 0, this.context.currentTime, .04);
  }

  update(snapshot: Snapshot, active: boolean, input: InputFrame) {
    const c = this.context;
    if (!c || c.state !== 'running' || !this.music || !this.effects) return;
    const t = c.currentTime;
    if (this.nextBar < t - BAR_SECONDS) this.nextBar = t + .05;
    while (this.nextBar < t + .15) { scheduleMusicBar(c, this.music, this.nextBar, this.bar++); this.nextBar += BAR_SECONDS; }
    const speed = Math.hypot(snapshot.vehicle.velocity.x, snapshot.vehicle.velocity.z);
    const engineOn = active && snapshot.systems.engine && (snapshot.player.driving || speed > .7);
    this.engine!.frequency.setTargetAtTime(34 + Math.min(speed, 14) * 4 + Math.abs(snapshot.vehicle.throttle) * 13 + Math.sin(t * 17) * 1.2, t, .07);
    this.engineGain!.gain.setTargetAtTime(engineOn ? .09 + Math.min(speed, 14) * .003 : 0, t, .08);
    const reeling = active && snapshot.systems.winch && snapshot.winch.phase === 'attached' && input.reel !== 0;
    this.motor!.frequency.setTargetAtTime(230 - snapshot.winch.tension / 500, t, .06);
    this.motorGain!.gain.setTargetAtTime(reeling ? .055 : 0, t, .06);
    this.windGain!.gain.setTargetAtTime(active ? .035 + Math.min(speed, 14) * .002 : .005, t, .1);

    const previous = this.previous;
    this.previous = snapshot;
    if (!previous || previous.tick === snapshot.tick) return;
    if (active && snapshot.recovery.kicks > previous.recovery.kicks) {
      rustle(c,this.effects,t,.12,.32,420);
      tone(c,this.effects,90,t,.16,.2,'triangle',45);
      tone(c,this.effects,110,t+.07,.48,.13,'sine',560);
    }
    if (active && snapshot.vehicle.throttle < -.1 && t >= this.nextReverseBeep) {
      tone(c, this.effects, 760, t, .16, .065, 'sine'); this.nextReverseBeep = t + .7;
    }
    for (const event of snapshot.events) {
      if (event.sequence <= this.cargoSequence) continue;
      this.cargoSequence = event.sequence;
      if (!active) continue;
      if (event.kind === 'ready') {
        [50, 57, 62, 69].forEach((note, i) => tone(c, this.effects!, noteFrequency(note), t + i * .12, .3, .08));
        rustle(c, this.effects, t + .25, .3, .17, 180);
      } else if (event.kind === 'eject' || event.kind === 'rescue') {
        rustle(c, this.effects, t, .24, .23, 600);
        tone(c, this.effects, 620, t + .08, .23, .09, 'square', 220);
      } else if (event.kind === 'rattle') {
        tone(c, this.effects, 135, t, .045, .025, 'triangle', 75);
      } else if (event.kind === 'impact') {
        rustle(c, this.effects, t, .12, .2, 480); tone(c, this.effects, 135, t, .15, .12, 'sine', 45);
      } else {
        rustle(c, this.effects, t, .07, .14, 1700);
        tone(c, this.effects, event.kind === 'dock' ? 460 : 200, t, .13, .06, 'triangle', event.kind === 'dock' ? 920 : 110);
      }
    }
    if (snapshot.systems.startupCompleted && previous.systems.skills !== snapshot.systems.skills) {
      tone(c, this.effects, snapshot.systems.skills === 'swapped' ? 720 : 280, t, .35, .075, 'triangle', snapshot.systems.skills === 'swapped' ? 180 : 880);
    }
    if (previous.winch.phase !== snapshot.winch.phase) {
      rustle(c, this.effects, t, .1, .15, 2200);
      tone(c, this.effects, snapshot.winch.phase === 'attached' ? 1400 : 820, t, .15, .065, 'triangle', 650);
    }
    if (previous.player.driving !== snapshot.player.driving) {
      rustle(c, this.effects, t, .14, .18, 500);
      tone(c, this.effects, 110, t, .13, .14, 'sine', 45);
    }
    if (active && !snapshot.player.driving) {
      const d = Math.hypot(snapshot.player.position.x - previous.player.position.x, snapshot.player.position.z - previous.player.position.z);
      if (d < 1 && snapshot.player.grounded) this.footDistance += d;
      if (this.footDistance > .72) {
        this.footDistance %= .72;
        rustle(c, this.effects, t, .1, .16, 900);
        tone(c, this.effects, 105, t, .06, .04, 'sine', 55);
      }
      if (previous.player.grounded && !snapshot.player.grounded && snapshot.player.position.y > previous.player.position.y) tone(c, this.effects, 170, t, .12, .045, 'sine', 240);
      if (!previous.player.grounded && snapshot.player.grounded) rustle(c, this.effects, t, .13, .17, 550);
    }
    if (active && previous.vehicle.speed - snapshot.vehicle.speed > 2.8) {
      rustle(c, this.effects, t, .2, .24, 650);
      tone(c, this.effects, 100, t, .22, .15, 'sine', 32);
    }
    if (!previous.progress.finished && snapshot.progress.finished) {
      [62, 66, 69, 74].forEach((note, i) => pluck(c, this.effects!, note, t + i * .13, .75, 1.2));
    }
  }

  debug() {
    this.analyser?.getFloatTimeDomainData(this.samples);
    const rms = Math.sqrt(this.samples.reduce((sum, n) => sum + n * n, 0) / this.samples.length);
    return { state: this.unavailable ? 'unavailable' : this.context?.state ?? 'locked', musicEnabled: this.musicEnabled, effectsEnabled: this.effectsEnabled, outputRms: rms };
  }
}
