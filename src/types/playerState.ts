export const PLAYER_STATE_VERSION = 2;

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
  mode?: 'music';
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

export interface PersistedRadioState {
  mode: 'radio';
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  regionKey: string;
  stationId: string;
  volume: number;
  paused: boolean;
  requesterId?: string;
  savedAt: number;
}
export type PersistedPlaybackState = PersistedQueueState | PersistedRadioState;
export type PlayerStateSnapshot = PersistedPlaybackState[];

export interface PlayerStateFile {
  version: typeof PLAYER_STATE_VERSION;
  guilds: PlayerStateSnapshot;
}
