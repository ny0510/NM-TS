import type {Player} from 'shoukaku';
import type {Queue} from '@/features/music/queue/Queue';
import type {RadioSession} from '@/features/radio/RadioSession';
import type {CreateQueueOptions, QueueTrack} from './music';

export type PlaybackMode = 'music' | 'radio';
export interface PlaybackSession {
  readonly mode: PlaybackMode;
  readonly sessionId: string;
  readonly guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  readonly player: Player;
  playing: boolean;
  readonly paused: boolean;
  readonly volume: number;
  pause(state: boolean): Promise<void>;
  setVolume(level: number): Promise<void>;
  getCurrent(): QueueTrack | null;
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  onCleanup(callback: () => void): void;
  destroy(): Promise<void>;
}
export interface SessionMutation {
  getSession(): PlaybackSession | undefined;
  getQueue(): Queue | undefined;
  getRadioSession(): RadioSession | undefined;
  createQueue(options: CreateQueueOptions): Promise<Queue>;
  createRadioSession(options: CreateQueueOptions): Promise<RadioSession>;
  destroySession(expectedSessionId: string): Promise<boolean>;
}
