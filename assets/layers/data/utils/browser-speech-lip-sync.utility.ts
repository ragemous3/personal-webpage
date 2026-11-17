import { type TalkingHead } from '@met4citizen/talkinghead';
import { LipsyncEn } from '@met4citizen/talkinghead/modules/lipsync-en.mjs';

export class BrowserSpeechLipSync {
  readonly #words: Array<{ index: number; end: number; time: number }> = [];
  readonly #frames: Array<{ time: number; end: number; viseme: string }> = [];
  #animation: number | undefined;
  #origin = 0;
  #current: string | undefined;
  #running = false;
  constructor(
    private readonly head: Pick<
      TalkingHead,
      'start' | 'stop' | 'stopSpeaking' | 'animQueue' | 'animFactory'
    >,
    text: string,
    rate: number,
  ) {
    const converter = new LipsyncEn();
    let time = 0;
    for (const match of text.matchAll(/\S+/gu)) {
      const word = match[0];
      this.#words.push({ index: match.index, end: match.index + word.length, time });
      const shapes = converter.wordsToVisemes(converter.preProcessText(word));
      const total = (shapes.times.at(-1) ?? 0) + (shapes.durations.at(-1) ?? 0);
      const duration = Math.max(160, word.length * 65) / rate;
      for (const [index, viseme] of shapes.visemes.entries()) {
        const start = ((shapes.times[index] ?? 0) / total) * duration;
        const length = ((shapes.durations[index] ?? 0) / total) * duration;
        this.#frames.push({ time: time + start, end: time + start + length, viseme });
      }
      time += duration + (/[.!?,;:]$/u.test(word) ? 180 : 60) / rate;
    }
  }
  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#origin = performance.now();
    this.head.start();
    this.#tick();
  }
  boundary(index: number): void {
    if (!this.#running) return;
    const word = this.#words.find((word) => index >= word.index && index < word.end);
    if (word) this.#origin = performance.now() - word.time;
  }
  stop(): void {
    if (!this.#running) return;
    this.#running = false;
    if (this.#animation !== undefined) cancelAnimationFrame(this.#animation);
    this.#setViseme();
    this.head.stopSpeaking();
    this.head.stop();
  }
  readonly #tick = (): void => {
    if (!this.#running) return;
    const time = performance.now() - this.#origin;
    const frame = this.#frames.find((frame) => time >= frame.time && time < frame.end);
    this.#setViseme(frame?.viseme);
    this.#animation = requestAnimationFrame(this.#tick);
  };
  #animate(viseme: string, value: number): void {
    this.head.animQueue.push(
      this.head.animFactory({
        name: 'viseme',
        dt: [0, 60],
        vs: { [`viseme_${viseme}`]: [null, value] },
      }),
    );
  }
  #setViseme(viseme?: string): void {
    if (viseme === this.#current) return;
    if (this.#current) this.#animate(this.#current, 0);
    this.#current = viseme;
    if (viseme) this.#animate(viseme, 0.7);
  }
}
