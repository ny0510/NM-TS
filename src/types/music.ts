import type {User} from 'discord.js';
import type {LavalinkResponse, Track} from 'shoukaku';

export enum RepeatMode {
  OFF = 'off',
  TRACK = 'track',
  QUEUE = 'queue',
}

export interface QueueTrack extends Track {
  requester?: User;
  isAutoplay?: boolean;
  playContext?: {
    requestChannelId?: string;
    playContext?: 'play' | 'quick_add' | 'restore' | 'autoplay';
    endedReason?: 'finished' | 'skipped' | 'stopped' | 'replaced' | 'stuck' | 'exception' | 'loadFailed' | 'cleanup';
  };
}

export interface CreateQueueOptions {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  shardId: number;
  volume?: number;
  deaf?: boolean;
  mute?: boolean;
}

export interface SearchResult {
  response: LavalinkResponse;
  tracks: QueueTrack[];
}

export interface AddTrackOptions {
  query: string;
  addFirst?: boolean;
  index?: number | null;
  ignorePlaylist?: boolean;
  excludeCover?: boolean;
  excludeShorts?: boolean;
  source?: 'play' | 'quick_add';
}
