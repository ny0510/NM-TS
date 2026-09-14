import type {NMClient} from '@/client';
import type {Queue} from '@/features/music/queue/Queue';

export interface PlayerEventContext {
  queue: Queue;
  client: NMClient;
  guildName: string;
  guildId: string;
}
