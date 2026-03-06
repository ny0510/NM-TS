import type {SerializedSession} from '@/structures/Queue';
import {Logger} from '@/utils/logger';

const logger = new Logger('SessionStore');

const SESSION_DIR = 'shoukaku/sessions';
const SESSION_IDS_FILE = `${SESSION_DIR}/sessionIds.json`;
const PLAYERS_DIR = `${SESSION_DIR}/players`;

export async function loadSessionIds(): Promise<Record<string, string>> {
  const file = Bun.file(SESSION_IDS_FILE);
  if (!(await file.exists())) return {};

  try {
    const data = (await file.json()) as Record<string, string>;
    logger.debug(`Loaded ${Object.keys(data).length} session ID(s) from disk`);
    return data;
  } catch (error) {
    logger.warn(`Failed to read session IDs: ${error}`);
    return {};
  }
}

export async function saveSessionIds(sessionIds: Record<string, string>): Promise<void> {
  try {
    await Bun.write(SESSION_IDS_FILE, JSON.stringify(sessionIds, null, 2));
    logger.debug(`Saved ${Object.keys(sessionIds).length} session ID(s) to disk`);
  } catch (error) {
    logger.error(`Failed to save session IDs: ${error}`);
  }
}

function playerStatePath(guildId: string): string {
  return `${PLAYERS_DIR}/${guildId}/state.json`;
}

export async function savePlayerState(guildId: string, session: SerializedSession): Promise<void> {
  try {
    await Bun.write(playerStatePath(guildId), JSON.stringify(session, null, 2));
  } catch (error) {
    logger.error(`Failed to save player state for guild ${guildId}: ${error}`);
  }
}

export async function loadAllPlayerStates(): Promise<SerializedSession[]> {
  const glob = new Bun.Glob(`${PLAYERS_DIR}/*/state.json`);
  const sessions: SerializedSession[] = [];

  for await (const path of glob.scan()) {
    try {
      const file = Bun.file(path);
      if (await file.exists()) {
        const data = (await file.json()) as SerializedSession;
        sessions.push(data);
      }
    } catch (error) {
      logger.warn(`Failed to read player state from ${path}: ${error}`);
    }
  }

  return sessions;
}

export async function clearAllPlayerStates(): Promise<void> {
  const glob = new Bun.Glob(`${PLAYERS_DIR}/*/state.json`);

  for await (const path of glob.scan()) {
    try {
      const file = Bun.file(path);
      if (await file.exists()) {
        await file.unlink();
      }
    } catch (error) {
      logger.warn(`Failed to delete player state ${path}: ${error}`);
    }
  }
}
