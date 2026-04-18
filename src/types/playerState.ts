export const PLAYER_STATE_VERSION = 1;

export interface PersistedTrackInfo {
  identifier: string;
  isSeekable: boolean;
  author: string;
  length: number;
  isStream: boolean;
  position: number;
  title: string;
  uri?: string;
  artworkUrl?: string;
  isrc?: string;
  sourceName: string;
}

export interface PersistedTrack {
  encoded: string;
  info: PersistedTrackInfo;
  requesterId?: string;
}

export interface PersistedQueueState {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  currentTrack: {
    encoded: string;
    info: PersistedTrackInfo;
    position: number;
    paused: boolean;
    requesterId?: string;
  } | null;
  tracks: PersistedTrack[];
  previous: PersistedTrack[];
  repeatMode: 'off' | 'track' | 'queue';
  autoplay: boolean;
  autoplayRequesterId?: string;
  autoShuffle: boolean;
  volume: number;
  savedAt: number;
}

export type PlayerStateSnapshot = PersistedQueueState[];

export interface PlayerStateFile {
  version: typeof PLAYER_STATE_VERSION;
  guilds: PlayerStateSnapshot;
}
