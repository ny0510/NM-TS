import type {Player, Shoukaku} from 'shoukaku';
import type {QueueTrack} from '@/types/music';
import type {PlaybackSession} from '@/types/playback';
import type {RadioStation} from '@/types/radio';

export class RadioSession implements PlaybackSession {
  readonly mode = 'radio' as const;
  readonly sessionId = crypto.randomUUID();
  readonly guildId: string;
  readonly player: Player;
  readonly shoukaku: Shoukaku;
  voiceChannelId: string;
  textChannelId: string;
  playing = false;
  regionKey: string | undefined;
  station: RadioStation | undefined;
  private current: QueueTrack | null = null;
  private level: number;
  private generation = 0;
  private destroyed = false;
  private readonly metadata = new Map<string, unknown>();
  private readonly cleanup = new Set<() => void>();

  constructor(options: {shoukaku: Shoukaku; player: Player; guildId: string; voiceChannelId: string; textChannelId: string; volume?: number}) {
    this.shoukaku = options.shoukaku;
    this.player = options.player;
    this.guildId = options.guildId;
    this.voiceChannelId = options.voiceChannelId;
    this.textChannelId = options.textChannelId;
    this.level = options.volume ?? 100;
  }
  get volume(): number {
    return this.level;
  }
  get paused(): boolean {
    return this.player.paused;
  }
  getCurrent(): QueueTrack | null {
    return this.current;
  }
  get<T>(key: string): T | undefined {
    return this.metadata.get(key) as T | undefined;
  }
  set<T>(key: string, value: T): void {
    this.metadata.set(key, value);
  }
  onCleanup(callback: () => void): void {
    this.cleanup.add(callback);
  }
  beginTune(): number {
    return ++this.generation;
  }
  getTuneGeneration(): number {
    return this.generation;
  }
  async pause(state: boolean): Promise<void> {
    await this.player.setPaused(state);
  }
  async setVolume(level: number): Promise<void> {
    this.level = Math.max(0, Math.min(100, level));
    await this.player.setGlobalVolume(this.level);
  }
  async tune(regionKey: string, station: RadioStation, track: QueueTrack, generation = this.beginTune()): Promise<boolean> {
    if (this.destroyed || generation !== this.generation) return false;
    const previous = {regionKey: this.regionKey, station: this.station, track: this.current, playing: this.playing, failureReported: this.get<boolean>('failureReported')};
    this.regionKey = regionKey;
    this.station = station;
    this.current = track;
    this.set('failureReported', false);
    try {
      await this.player.playTrack({track: {encoded: track.encoded}});
    } catch (error) {
      if (!this.destroyed && generation === this.generation) {
        this.regionKey = previous.regionKey;
        this.station = previous.station;
        this.current = previous.track;
        this.playing = previous.playing;
        this.set('failureReported', previous.failureReported);
      }
      throw error;
    }
    if (this.destroyed || generation !== this.generation) return false;
    await this.player.setGlobalVolume(this.level);
    await this.player.setPaused(false);
    this.playing = true;
    return true;
  }
  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.generation++;
    this.playing = false;
    this.current = null;
    const errors: unknown[] = [];
    for (const callback of this.cleanup) {
      try {
        callback();
      } catch (error) {
        errors.push(error);
      }
    }
    this.cleanup.clear();
    this.player.removeAllListeners();
    try {
      await this.shoukaku.leaveVoiceChannel(this.guildId);
    } catch (error) {
      errors.push(error);
    }
    this.metadata.clear();
    if (errors.length) throw new AggregateError(errors, 'Failed to clean radio session');
  }
}
