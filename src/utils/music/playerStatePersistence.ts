import {eq} from 'drizzle-orm';

import {getDb} from '@/db';
import {playerStates} from '@/db/schema';
import {PLAYER_STATE_VERSION, type PersistedQueueState} from '@/types/playerState';
import {Logger} from '@/utils/logger';

const logger = new Logger('PlayerStateDB');

export interface PlayerStateRecord {
  guildId: string;
  version: number;
  state: PersistedQueueState;
  createdAt: Date;
  updatedAt: Date;
}

export async function replacePlayerStates(states: PersistedQueueState[]): Promise<void> {
  const db = getDb();

  await db.transaction(async tx => {
    await tx.delete(playerStates);

    if (states.length === 0) return;

    await tx.insert(playerStates).values(
      states.map(state => ({
        guildId: state.guildId,
        version: PLAYER_STATE_VERSION,
        state,
        updatedAt: new Date(),
      })),
    );
  });

  logger.info(`Saved player state for ${states.length} guild(s)`);
}

export async function loadPlayerStates(): Promise<PlayerStateRecord[]> {
  const db = getDb();

  return await db.select().from(playerStates).orderBy(playerStates.guildId);
}

export async function clearPlayerStates(): Promise<void> {
  const db = getDb();

  await db.delete(playerStates);
  logger.info('Cleared persisted player states');
}

export async function deletePersistedPlayerState(guildId: string): Promise<void> {
  const db = getDb();

  await db.delete(playerStates).where(eq(playerStates.guildId, guildId));
}
