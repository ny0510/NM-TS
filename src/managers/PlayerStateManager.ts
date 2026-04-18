import {type Client, EmbedBuilder} from 'discord.js';
import {dirname} from 'node:path';

import type {NMClient} from '@/client/Client';
import type {Config} from '@/client/types';
import type {Queue, QueueTrack} from '@/structures/Queue';
import {PLAYER_STATE_VERSION, type PersistedQueueState, type PersistedTrackInfo, type PlayerStateFile} from '@/types/playerState';
import type {ILogger} from '@/utils/logger';
import {mkdir, rename} from 'node:fs/promises';

const RESTORE_TIMEOUT_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class PlayerStateManager {
  private readonly client: Client;
  private readonly logger: ILogger;
  private readonly config: Config;

  constructor(client: Client, logger: ILogger, config: Config) {
    this.client = client;
    this.logger = logger;
    this.config = config;
  }

  public getSnapshotPath(): string {
    return this.config.PLAYER_STATE_PATH;
  }

  public async saveAll(): Promise<void> {
    const nmClient = this.client as unknown as NMClient;
    const queues = nmClient.queues;

    try {
      if (queues.size === 0) {
        try {
          await Bun.file(this.getSnapshotPath()).delete();
        } catch {
          // 파일이 없으면 무시
        }
        this.logger.info('No active queues, deleted snapshot file if it existed');
        return;
      }

      const states: PersistedQueueState[] = [];

      for (const queue of queues.values()) {
        const current = queue.getCurrent();
        const repeatMode = queue.trackRepeat ? 'track' : queue.queueRepeat ? 'queue' : 'off';

        states.push({
          guildId: queue.guildId,
          voiceChannelId: queue.voiceChannelId,
          textChannelId: queue.textChannelId,
          currentTrack: current
            ? {
                encoded: current.encoded,
                info: current.info,
                position: queue.position,
                paused: queue.paused,
                requesterId: current.requester?.id,
              }
            : null,
          tracks: queue.getTracks().map(track => ({
            encoded: track.encoded,
            info: track.info,
            requesterId: track.requester?.id,
          })),
          previous: queue.previous.map(track => ({
            encoded: track.encoded,
            info: track.info,
            requesterId: track.requester?.id,
          })),
          repeatMode,
          autoplay: queue.isAutoplay,
          autoplayRequesterId: queue.getAutoplayRequester()?.id,
          autoShuffle: queue.isAutoShuffle,
          volume: queue.volume,
          savedAt: Date.now(),
        });
      }

      const file: PlayerStateFile = {
        version: PLAYER_STATE_VERSION,
        guilds: states,
      };

      // 원자적 쓰기: 임시 파일 작성 후 rename
      const snapshotPath = this.getSnapshotPath();
      const dir = dirname(snapshotPath);
      await mkdir(dir, {recursive: true});

      const tmpPath = `${snapshotPath}.tmp`;
      await Bun.write(tmpPath, JSON.stringify(file, null, 2));
      await rename(tmpPath, snapshotPath);

      this.logger.info(`Saved player state for ${states.length} guild(s)`);
    } catch (error) {
      this.logger.error(`Failed to save player state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async restoreAll(): Promise<{restored: number; total: number; failed: number}> {
    const snapshotPath = this.getSnapshotPath();
    const result = {restored: 0, total: 0, failed: 0};

    try {
      let raw: string;
      try {
        raw = await Bun.file(snapshotPath).text();
      } catch {
        this.logger.info('No player state snapshot found, skipping restore');
        return result;
      }

      const file: PlayerStateFile = JSON.parse(raw);

      if (file.version !== PLAYER_STATE_VERSION) {
        this.logger.warn(`Player state version mismatch: expected ${PLAYER_STATE_VERSION}, got ${file.version}. Skipping restore.`);
        return result;
      }

      result.total = file.guilds.length;
      this.logger.info(`Restoring player state for ${result.total} guild(s)`);

      for (const state of file.guilds) {
        try {
          const restored = await Promise.race([this.restoreQueue(state), sleep(RESTORE_TIMEOUT_MS)]);
          if (restored === 'restored') {
            result.restored++;
          } else if (restored === 'skipped') {
            this.logger.debug(`Skipped restore for guild ${state.guildId}`);
          } else {
            result.failed++;
            this.logger.warn(`Restore timed out or failed for guild ${state.guildId}`);
          }
        } catch (error) {
          result.failed++;
          this.logger.error(`Failed to restore guild ${state.guildId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      await this.clearSnapshot();
      this.logger.info(`Restore complete: ${result.restored}/${result.total} succeeded, ${result.failed} failed`);
    } catch (error) {
      this.logger.error(`Failed to restore player state: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  private async restoreQueue(state: PersistedQueueState): Promise<'restored' | 'skipped'> {
    const nmClient = this.client as unknown as NMClient;

    const guild = nmClient.guilds.cache.get(state.guildId);
    if (!guild) {
      this.logger.debug(`Guild ${state.guildId} not found in cache, skipping restore`);
      return 'skipped'; // 스킵은 실패가 아님
    }

    const voiceChannel = nmClient.channels.cache.get(state.voiceChannelId);
    const textChannel = nmClient.channels.cache.get(state.textChannelId);
    if (!voiceChannel?.isVoiceBased() || !textChannel?.isSendable()) {
      this.logger.debug(`Channels not found for guild ${state.guildId}, skipping restore`);
      return 'skipped';
    }

    let queue: Queue;
    try {
      queue = await nmClient.services.lavalinkManager.createQueue({
        guildId: state.guildId,
        voiceChannelId: state.voiceChannelId,
        textChannelId: state.textChannelId,
        shardId: guild.shardId,
        volume: state.volume,
      });
    } catch (error) {
      this.logger.error(`Failed to create queue for guild ${state.guildId}: ${error instanceof Error ? error.message : String(error)}`);
      return 'skipped';
    }

    queue.set('isRestoring', true);

    const requesterIds = new Set<string>();
    if (state.currentTrack?.requesterId) requesterIds.add(state.currentTrack.requesterId);
    for (const t of state.tracks) {
      if (t.requesterId) requesterIds.add(t.requesterId);
    }
    for (const t of state.previous) {
      if (t.requesterId) requesterIds.add(t.requesterId);
    }

    const requesterMap = new Map<string, Awaited<ReturnType<typeof nmClient.users.fetch>>>();
    for (const id of requesterIds) {
      try {
        const user = await nmClient.users.fetch(id);
        requesterMap.set(id, user);
      } catch {
        // 사용자를 찾을 수 없으면 undefined로 처리
      }
    }

    const makeTrack = (persisted: {encoded: string; info: PersistedQueueState['tracks'][number]['info']; requesterId?: string}): QueueTrack => ({
      encoded: persisted.encoded,
      info: persisted.info,
      pluginInfo: undefined,
      requester: persisted.requesterId ? requesterMap.get(persisted.requesterId) : undefined,
    });

    queue.previous = state.previous.map(t => makeTrack(t));

    const queueTracks = state.tracks.map(t => makeTrack(t));
    if (queueTracks.length > 0) {
      queue.add(queueTracks);
    }

    if (state.currentTrack) {
      const currentTrackObj = makeTrack(state.currentTrack);

      await queue.player.playTrack({track: {encoded: state.currentTrack.encoded}});
      queue.setCurrent(currentTrackObj);
      queue.playing = true;

      if (state.currentTrack.position > 0) {
        try {
          await queue.player.seekTo(state.currentTrack.position);
        } catch {
          // 시크 실패 무시
        }
      }

      await queue.player.setGlobalVolume(state.volume);

      if (state.currentTrack.paused) {
        await queue.player.setPaused(true);
      }
    } else {
      await queue.player.setGlobalVolume(state.volume);
    }

    if (state.repeatMode === 'track') {
      queue.setTrackRepeat(true);
    } else if (state.repeatMode === 'queue') {
      queue.setQueueRepeat(true);
    }

    if (state.autoplay) {
      const autoplayUser = state.autoplayRequesterId ? requesterMap.get(state.autoplayRequesterId) : undefined;
      queue.setAutoplay(true, autoplayUser);
    }

    if (state.autoShuffle) {
      queue.setAutoShuffle(true);
    }

    queue.set('isRestoring', false);

    // 복구 후 빈 음성채널 검사
    const restoreVoiceChannel = nmClient.channels.cache.get(state.voiceChannelId);
    if (restoreVoiceChannel?.isVoiceBased()) {
      const nonBotMembers = restoreVoiceChannel.members.filter(m => !m.user.bot);
      if (nonBotMembers.size === 0) {
        await queue.pause(true);
        this.logger.info(`Restored queue for guild ${state.guildId} is in empty channel, pausing`);

        if (textChannel?.isSendable()) {
          try {
            const endTime = Math.floor((Date.now() + 10 * 60 * 1000) / 1000);
            await textChannel.send({
              embeds: [new EmbedBuilder().setTitle('아무도 없어서 음악을 일시정지했어요.').setDescription(`<t:${endTime}:R> 후에 자동으로 연결을 종료해요.`).setColor(nmClient.config.EMBED_COLOR_NORMAL)],
            });
          } catch {
            // 임베드 전송 실패 무시
          }
        }
      }
    }

    if (textChannel?.isSendable()) {
      try {
        const isPaused = state.currentTrack?.paused ?? false;
        const embed = new EmbedBuilder()
          .setTitle('봇이 재시작되어 이전 재생 상태를 복구했어요.')
          .setDescription(isPaused ? '일시정지 상태로 복구되었어요.' : '음악을 이어서 재생할게요.')
          .setColor(nmClient.config.EMBED_COLOR_NORMAL);

        await textChannel.send({embeds: [embed]});
      } catch {
        // 임베드 전송 실패 무시
      }
    }

    this.logger.info(`Successfully restored queue for guild ${state.guildId}`);
    return 'restored';
  }

  public async clearSnapshot(): Promise<void> {
    try {
      await Bun.file(this.getSnapshotPath()).delete();
    } catch {
      // 파일이 없으면 무시
    }
  }
}
