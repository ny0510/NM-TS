import type {User} from 'discord.js';
import type {Player, Shoukaku, Track} from 'shoukaku';

export enum RepeatMode {
  OFF = 'off',
  TRACK = 'track',
  QUEUE = 'queue',
}

export interface QueueTrack extends Track {
  requester?: User;
}

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
  // 사용자 단위 0-100, Shoukaku 내부는 0-1000 스케일
  private _volume: number;

  constructor(options: {shoukaku: Shoukaku; player: Player; guildId: string; textChannelId: string; voiceChannelId: string; volume?: number}) {
    this.shoukaku = options.shoukaku;
    this.player = options.player;
    this.guildId = options.guildId;
    this.textChannelId = options.textChannelId;
    this.voiceChannelId = options.voiceChannelId;
    this._volume = options.volume ?? 100;
  }

  public get volume(): number {
    return this._volume;
  }

  public async setVolume(level: number): Promise<void> {
    this._volume = Math.max(0, Math.min(level, 100));
    await this.player.setGlobalVolume(this._volume);
  }

  public get paused(): boolean {
    return this.player.paused;
  }

  public async pause(state: boolean): Promise<void> {
    await this.player.setPaused(state);
  }

  public get position(): number {
    return this.player.position;
  }

  public async seek(position: number): Promise<void> {
    await this.player.seekTo(position);
  }

  public get trackRepeat(): boolean {
    return this.repeatMode === RepeatMode.TRACK;
  }

  public get queueRepeat(): boolean {
    return this.repeatMode === RepeatMode.QUEUE;
  }

  public setTrackRepeat(enabled: boolean): void {
    if (enabled) {
      this.repeatMode = RepeatMode.TRACK;
    } else if (this.repeatMode === RepeatMode.TRACK) {
      this.repeatMode = RepeatMode.OFF;
    }
  }

  public setQueueRepeat(enabled: boolean): void {
    if (enabled) {
      this.repeatMode = RepeatMode.QUEUE;
    } else if (this.repeatMode === RepeatMode.QUEUE) {
      this.repeatMode = RepeatMode.OFF;
    }
  }

  public get isAutoplay(): boolean {
    return this.autoplay;
  }

  public setAutoplay(enabled: boolean, user?: User): void {
    this.autoplay = enabled;
    if (user) this.autoplayRequester = user;
    if (!enabled) this.autoplayRequester = undefined;
  }

  public getAutoplayRequester(): User | undefined {
    return this.autoplayRequester;
  }

  public get isAutoShuffle(): boolean {
    return this.autoShuffle;
  }

  public setAutoShuffle(enabled: boolean): void {
    this.autoShuffle = enabled;
  }

  public set<T>(key: string, value: T): void {
    this.metadata.set(key, value);
  }

  public get<T>(key: string): T | undefined {
    return this.metadata.get(key) as T | undefined;
  }

  public size(): number {
    return this.tracks.length;
  }

  // 현재 재생 중인 트랙 + 대기열 합산 (ms)
  public duration(): number {
    const currentDuration = this.current?.info.length ?? 0;
    const queueDuration = this.tracks.reduce((acc, track) => acc + (track.info.length ?? 0), 0);
    return currentDuration + queueDuration;
  }

  public getCurrent(): QueueTrack | null {
    return this.current;
  }

  public setCurrent(track: QueueTrack | null): void {
    this.current = track;
  }

  public getSlice(start: number, end: number): QueueTrack[] {
    return this.tracks.slice(start, end);
  }

  public getTracks(): QueueTrack[] {
    return [...this.tracks];
  }

  public add(trackOrTracks: QueueTrack | QueueTrack[], position?: number): void {
    const tracksToAdd = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];

    if (position !== undefined && position >= 0) {
      this.tracks.splice(position, 0, ...tracksToAdd);
    } else {
      this.tracks.push(...tracksToAdd);
    }
  }

  public remove(index: number): QueueTrack | undefined {
    if (index < 0 || index >= this.tracks.length) return undefined;
    return this.tracks.splice(index, 1)[0];
  }

  public clear(): void {
    this.tracks = [];
  }

  // Fisher-Yates 알고리즘
  public shuffle(): void {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i]!, this.tracks[j]!] = [this.tracks[j]!, this.tracks[i]!];
    }
  }

  // 요청자별 균등 분배 셔플
  public roundRobinShuffle(): void {
    const byRequester = new Map<string, QueueTrack[]>();

    for (const track of this.tracks) {
      const id = track.requester?.id ?? 'unknown';
      const list = byRequester.get(id);
      if (list) {
        list.push(track);
      } else {
        byRequester.set(id, [track]);
      }
    }

    for (const tracks of byRequester.values()) {
      for (let i = tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tracks[i]!, tracks[j]!] = [tracks[j]!, tracks[i]!];
      }
    }

    const requesters = [...byRequester.keys()];
    for (let i = requesters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [requesters[i]!, requesters[j]!] = [requesters[j]!, requesters[i]!];
    }

    const result: QueueTrack[] = [];
    let hasMore = true;

    while (hasMore) {
      hasMore = false;
      for (const id of requesters) {
        const tracks = byRequester.get(id);
        if (tracks && tracks.length > 0) {
          const track = tracks.shift();
          if (track) result.push(track);
          if (tracks.length > 0) hasMore = true;
        }
      }
    }

    this.tracks = result;
  }

  public async play(): Promise<void> {
    const track = this.tracks.shift();
    if (!track) return;

    this.current = track;
    this.playing = true;

    await this.player.playTrack({track: {encoded: track.encoded}});
    await this.player.setGlobalVolume(this._volume);
  }

  // stopTrack → end 이벤트 트리거 → lavalinkEvents에서 다음 트랙 처리
  public async stop(count?: number): Promise<void> {
    if (count && count > 1) {
      const removeCount = Math.min(count - 1, this.tracks.length);
      this.tracks.splice(0, removeCount);
    }
    await this.player.stopTrack();
  }

  // 자동 재생 시드용, 최대 25개 유지
  public addToPrevious(track: QueueTrack): void {
    this.previous.push(track);
    if (this.previous.length > 25) {
      this.previous.shift();
    }
  }

  public async setTimescale(options?: {speed?: number; pitch?: number; rate?: number}): Promise<void> {
    await this.player.setTimescale(options ?? undefined);
  }

  public async destroy(): Promise<void> {
    this.clear();
    this.current = null;
    this.playing = false;
    this.player.removeAllListeners();
    await this.shoukaku.leaveVoiceChannel(this.guildId);
    this.metadata.clear();
  }
}
