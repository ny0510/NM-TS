import type {User} from 'discord.js';
import type {Player, Shoukaku} from 'shoukaku';
import {type QueueTrack, RepeatMode} from '@/types/music';
import {calculateQueueDuration} from './duration';
import {MAX_QUEUE_SIZE, addTracks, removeTrack, roundRobinShuffle, shuffleQueue} from './manipulation';
import {shiftAndPlay, stopAndTrim} from './navigation';

export class Queue {
  public readonly shoukaku: Shoukaku;
  public readonly player: Player;
  public readonly guildId: string;
  public textChannelId: string;
  public voiceChannelId: string;
  public previous: QueueTrack[] = [];
  public playing = false;
  private tracks: QueueTrack[] = [];
  private current: QueueTrack | null = null;
  private repeatMode: RepeatMode = RepeatMode.OFF;
  private autoplay = false;
  private autoplayRequester: User | undefined;
  private autoShuffle = false;
  private readonly metadata = new Map<string, unknown>();
  private _volume: number;

  constructor(options: {shoukaku: Shoukaku; player: Player; guildId: string; textChannelId: string; voiceChannelId: string; volume?: number}) {
    this.shoukaku = options.shoukaku;
    this.player = options.player;
    this.guildId = options.guildId;
    this.textChannelId = options.textChannelId;
    this.voiceChannelId = options.voiceChannelId;
    this._volume = options.volume ?? 100;
  }

  get volume(): number { return this._volume; }
  async setVolume(level: number): Promise<void> { this._volume = Math.max(0, Math.min(level, 100)); await this.player.setGlobalVolume(this._volume); }
  get paused(): boolean { return this.player.paused; }
  async pause(state: boolean): Promise<void> { await this.player.setPaused(state); }
  get position(): number { return this.player.position; }
  async seek(position: number): Promise<void> { await this.player.seekTo(position); }
  async setTimescale(options?: {speed?: number; pitch?: number; rate?: number}): Promise<void> { await this.player.setTimescale(options ?? undefined); }
  get trackRepeat(): boolean { return this.repeatMode === RepeatMode.TRACK; }
  get queueRepeat(): boolean { return this.repeatMode === RepeatMode.QUEUE; }
  setTrackRepeat(enabled: boolean): void { if (enabled) this.repeatMode = RepeatMode.TRACK; else if (this.repeatMode === RepeatMode.TRACK) this.repeatMode = RepeatMode.OFF; }
  setQueueRepeat(enabled: boolean): void { if (enabled) this.repeatMode = RepeatMode.QUEUE; else if (this.repeatMode === RepeatMode.QUEUE) this.repeatMode = RepeatMode.OFF; }
  get isAutoplay(): boolean { return this.autoplay; }
  setAutoplay(enabled: boolean, user?: User): void { this.autoplay = enabled; this.autoplayRequester = enabled ? user : undefined; }
  getAutoplayRequester(): User | undefined { return this.autoplayRequester; }
  get isAutoShuffle(): boolean { return this.autoShuffle; }
  setAutoShuffle(enabled: boolean): void { this.autoShuffle = enabled; }
  set<T>(key: string, value: T): void { this.metadata.set(key, value); }
  get<T>(key: string): T | undefined { return this.metadata.get(key) as T | undefined; }
  size(): number { return this.tracks.length; }
  duration(): number { return calculateQueueDuration(this.tracks, this.current); }
  getCurrent(): QueueTrack | null { return this.current; }
  setCurrent(track: QueueTrack | null): void { this.current = track; }
  getCurrentPlayContext(): QueueTrack['playContext'] | undefined { return this.current?.playContext; }
  getSlice(start: number, end: number): QueueTrack[] { return this.tracks.slice(start, end); }
  getTracks(): QueueTrack[] { return [...this.tracks]; }
  isFull(): boolean { return this.tracks.length >= MAX_QUEUE_SIZE; }
  add(trackOrTracks: QueueTrack | QueueTrack[], position?: number): void { addTracks(this.tracks, trackOrTracks, position); }
  remove(index: number): QueueTrack | undefined { return removeTrack(this.tracks, index); }
  clear(): void { this.tracks = []; }
  shuffle(): void { this.tracks = shuffleQueue(this.tracks); }
  roundRobinShuffle(): void { this.tracks = roundRobinShuffle(this.tracks); }
  addToPrevious(track: QueueTrack): void { this.previous.push(track); if (this.previous.length > 25) this.previous.shift(); }
  async play(): Promise<void> { const {track, playing} = await shiftAndPlay(this.tracks, this.player, this._volume, this.textChannelId); this.current = track; this.playing = playing; }
  async stop(count?: number): Promise<void> { await stopAndTrim(this.tracks, this.player, count); }
  async destroy(): Promise<void> { this.clear(); this.current = null; this.playing = false; this.player.removeAllListeners(); await this.shoukaku.leaveVoiceChannel(this.guildId); this.metadata.clear(); }
}
