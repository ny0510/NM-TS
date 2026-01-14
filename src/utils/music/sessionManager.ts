import type {Player, Track} from 'magmastream';
import * as path from 'node:path';

import type {NMClient} from '@/client/Client';
import {config} from '@/utils/config';
import {Logger} from '@/utils/logger';
import * as fs from 'node:fs/promises';

const logger = new Logger('SessionManager', config.IS_DEV_MODE ? 'debug' : 'info');

// 세션 데이터 저장 경로
const SESSION_DIR = path.join(process.cwd(), 'data', 'sessions');

export interface PlayerSession {
  guildId: string;
  textChannelId: string | null;
  voiceChannelId: string | null;
  volume: number;
  paused: boolean;
  trackRepeat: boolean;
  queueRepeat: boolean;
  isAutoplay: boolean;
  currentTrack: Track | null;
  queue: Track[];
  position: number;
  timestamp: number;
}

/**
 * 플레이어 상태를 파일에 저장
 */
export async function savePlayerSession(player: Player): Promise<void> {
  try {
    await fs.mkdir(SESSION_DIR, {recursive: true});

    const currentTrack = await player.queue.getCurrent();
    const queueTracks = await player.queue.getTracks();

    const session: PlayerSession = {
      guildId: player.guildId,
      textChannelId: player.textChannelId,
      voiceChannelId: player.voiceChannelId,
      volume: player.volume,
      paused: player.paused,
      trackRepeat: player.trackRepeat,
      queueRepeat: player.queueRepeat,
      isAutoplay: player.isAutoplay,
      currentTrack,
      queue: queueTracks,
      position: player.position,
      timestamp: Date.now(),
    };

    const filePath = path.join(SESSION_DIR, `${player.guildId}.json`);
    await fs.writeFile(filePath, JSON.stringify(session), 'utf-8');
    logger.debug(`Session saved for guild ${player.guildId}: current=${currentTrack?.title ?? 'none'}, queue=${queueTracks.length}`);
  } catch (error) {
    logger.error(`Failed to save session for guild ${player.guildId}: ${error}`);
  }
}

/**
 * 모든 플레이어 세션 저장
 */
export async function saveAllSessions(client: NMClient): Promise<void> {
  const savePromises = Array.from(client.manager.players.values()).map(player => savePlayerSession(player));
  await Promise.allSettled(savePromises);
  logger.info(`Saved ${client.manager.players.size} player sessions`);
}

/**
 * 저장된 세션 로드
 */
export async function loadPlayerSession(guildId: string): Promise<PlayerSession | null> {
  try {
    const filePath = path.join(SESSION_DIR, `${guildId}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as PlayerSession;
  } catch {
    return null;
  }
}

/**
 * 세션 파일 삭제
 */
export async function deletePlayerSession(guildId: string): Promise<void> {
  try {
    const filePath = path.join(SESSION_DIR, `${guildId}.json`);
    await fs.unlink(filePath);
    logger.debug(`Session deleted for guild ${guildId}`);
  } catch {
    // 파일이 없으면 무시
  }
}

/**
 * 모든 저장된 세션 파일 목록 가져오기
 */
export async function getAllSavedSessionIds(): Promise<string[]> {
  try {
    await fs.mkdir(SESSION_DIR, {recursive: true});
    const files = await fs.readdir(SESSION_DIR);
    return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  } catch {
    return [];
  }
}

/**
 * Lavalink 플레이어와 magmastream 플레이어 모두 정리
 */
async function cleanupPlayer(client: NMClient, guildId: string, node: any): Promise<void> {
  // magmastream 플레이어 정리
  const existingPlayer = client.manager.players.get(guildId);
  if (existingPlayer) {
    existingPlayer.set('stoppedByCommand', true); // QueueEnd 메시지 방지
    existingPlayer.destroy();
    logger.debug(`Destroyed magmastream player for guild ${guildId}`);
  }

  // Lavalink 서버의 플레이어도 정리
  try {
    await node.rest.destroyPlayer(guildId);
    logger.debug(`Destroyed Lavalink player for guild ${guildId}`);
  } catch {
    // 플레이어가 없으면 무시
  }
}

/**
 * 플레이어 세션 복원
 */
export async function restorePlayerSession(client: NMClient, session: PlayerSession): Promise<boolean> {
  try {
    // Lavalink 서버에서 현재 재생 상태 확인
    const node = client.manager.useableNode;
    if (!node) {
      logger.error(`No available nodes to restore session for guild ${session.guildId}`);
      return false;
    }

    // 음성/텍스트 채널이 없으면 복원 불가
    if (!session.voiceChannelId || !session.textChannelId) {
      logger.error(`No voice/text channel to restore session for guild ${session.guildId}`);
      await cleanupPlayer(client, session.guildId, node);
      return false;
    }

    let voiceChannel;
    try {
      voiceChannel = await client.channels.fetch(session.voiceChannelId);
    } catch {
      voiceChannel = null;
    }
    if (!voiceChannel) {
      logger.warn(`Voice channel ${session.voiceChannelId} no longer exists for guild ${session.guildId}, skipping restore`);
      await deletePlayerSession(session.guildId);
      await cleanupPlayer(client, session.guildId, node);
      return false;
    }

    let textChannel;
    try {
      textChannel = await client.channels.fetch(session.textChannelId);
    } catch {
      textChannel = null;
    }
    if (!textChannel) {
      logger.warn(`Text channel ${session.textChannelId} no longer exists for guild ${session.guildId}, skipping restore`);
      await deletePlayerSession(session.guildId);
      await cleanupPlayer(client, session.guildId, node);
      return false;
    }

    let lavaPlayer;
    try {
      lavaPlayer = await node.rest.getPlayer(session.guildId);
    } catch {
      lavaPlayer = null;
    }

    // 플레이어 생성
    const player = client.manager.create({
      guildId: session.guildId,
      textChannelId: session.textChannelId,
      voiceChannelId: session.voiceChannelId,
      volume: session.volume,
      selfDeafen: true,
    });

    player.connect();

    // Lavalink에서 재생 중인 트랙이 있으면 current로 설정
    if (lavaPlayer?.track) {
      const {TrackUtils} = await import('magmastream');
      const currentTrack = TrackUtils.build(lavaPlayer.track, session.currentTrack?.requester);
      await player.queue.setCurrent(currentTrack);
      player.playing = !lavaPlayer.paused;
      player.paused = lavaPlayer.paused;
      logger.debug(`Restored current track from Lavalink: ${currentTrack.title}`);
    } else if (session.currentTrack) {
      // Lavalink에 트랙이 없으면 저장된 current 트랙으로 재생 시작
      await player.queue.add(session.currentTrack);
      await player.play();
      logger.debug(`Started playback from saved current track: ${session.currentTrack.title}`);
    }

    // 대기열 복원
    if (session.queue.length > 0) {
      await player.queue.add(session.queue);
      logger.debug(`Restored ${session.queue.length} tracks to queue`);
    }

    // 설정 복원
    if (session.trackRepeat) player.setTrackRepeat(true);
    if (session.queueRepeat) player.setQueueRepeat(true);
    if (session.isAutoplay) player.setAutoplay(true);

    // 세션 파일 삭제
    await deletePlayerSession(session.guildId);

    logger.info(`Session restored for guild ${session.guildId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to restore session for guild ${session.guildId}: ${error}`);
    return false;
  }
}

/**
 * 모든 저장된 세션 복원
 */
export async function restoreAllSessions(client: NMClient): Promise<void> {
  const sessionIds = await getAllSavedSessionIds();

  if (sessionIds.length === 0) {
    logger.debug('No saved sessions to restore');
    return;
  }

  logger.info(`Found ${sessionIds.length} saved sessions to restore`);

  for (const guildId of sessionIds) {
    const session = await loadPlayerSession(guildId);
    if (!session) continue;

    // 세션이 너무 오래됐으면 스킵 (5분)
    if (Date.now() - session.timestamp > 5 * 60 * 1000) {
      logger.debug(`Session for guild ${guildId} is too old, skipping`);
      await deletePlayerSession(guildId);
      continue;
    }

    const success = await restorePlayerSession(client, session);

    if (success) {
      // 복원 성공 시 채널에 메시지 전송
      const channel = client.channels.cache.get(session.textChannelId || '');
      if (channel?.isSendable()) {
        const {EmbedBuilder} = await import('discord.js');
        try {
          await channel.send({
            embeds: [new EmbedBuilder().setTitle('🔄 세션이 복원되었어요!').setDescription('이전 세션에서 재생을 이어갈게요.').setColor(client.config.EMBED_COLOR_NORMAL)],
          });
        } catch {
          // 메시지 전송 실패 시 무시
        }
      }
    }
  }
}
