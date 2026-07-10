import type {NMClient} from '@/client/Client';
import type {Queue} from '@/features/music/queue/Queue';

export interface PlayerEventContext {
  queue: Queue;
  client: NMClient;
  guildName: string;
  guildId: string;
}
