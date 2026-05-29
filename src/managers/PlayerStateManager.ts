import {type Client, EmbedBuilder} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Queue} from '@/structures/Queue';
import type {QueueTrack} from '@/types/music';
import {PLAYER_STATE_VERSION, type PersistedQueueState} from '@/types/playerState';
import type {ILogger} from '@/utils/logger';
import {clearPlayerStates, loadPlayerStates, replacePlayerStates} from '@/utils/music/playerStatePersistence';

const RESTORE_TIMEOUT_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class PlayerStateManager {
  private readonly client: Client;
  private readonly logger: ILogger;

  constructor(client: Client, logger: ILogger) {
    this.client = client;
    this.logger = logger;
  }

  public async saveAll(): Promise<void> {
    const nmClient = this.client as unknown as NMClient;
    const queues = nmClient.queues;

    try {
      if (queues.size === 0) {
        await clearPlayerStates();
        this.logger.info('No active queues, deleted persisted player states if they existed');
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

      await replacePlayerStates(states);
    } catch (error) {
      this.logger.error(error instanceof Error ? error : new Error(`Failed to save player state: ${error}`));
    }
  }

  public async restoreAll(): Promise<{restored: number; total: number; failed: number}> {
    const result = {restored: 0, total: 0, failed: 0};

    try {
      const states = await loadPlayerStates();

      const validStates = states.filter(state => state.version === PLAYER_STATE_VERSION).map(state => state.state);
      const skippedStates = states.length - validStates.length;

      if (states.length === 0) {
        this.logger.info('No persisted player state found, skipping restore');
        return result;
      }

      if (skippedStates > 0) {
        this.logger.warn(`Skipped ${skippedStates} player state record(s) due to version mismatch.`);
      }

      result.total = validStates.length;
      this.logger.info(`Restoring player state for ${result.total} guild(s)`);

      for (const state of validStates) {
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
          this.logger.error(error instanceof Error ? error : new Error(`Failed to restore guild ${state.guildId}: ${error}`));
        }
      }

      await clearPlayerStates();
      this.logger.info(`Restore complete: ${result.restored}/${result.total} succeeded, ${result.failed} failed`);
    } catch (error) {
      this.logger.error(error instanceof Error ? error : new Error(`Failed to restore player state: ${error}`));
    }

    return result;
  }

  private async restoreQueue(state: PersistedQueueState): Promise<'restored' | 'skipped'> {
    const nmClient = this.client as unknown as NMClient;

    const guild = nmClient.guilds.cache.get(state.guildId);
    if (!guild) {
      this.logger.debug(`Guild ${state.guildId} not found in cache, skipping restore`);
      return 'skipped';
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
      this.logger.error(error instanceof Error ? error : new Error(`Failed to create queue for guild ${state.guildId}: ${error}`));
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
    const fetchResults = await Promise.allSettled(
      [...requesterIds].map(async id => {
        const user = await nmClient.users.fetch(id);
        return {id, user};
      }),
    );

    for (const result of fetchResults) {
      if (result.status === 'fulfilled') {
        requesterMap.set(result.value.id, result.value.user);
      }
    }

    const makeTrack = (persisted: {encoded: string; info: PersistedQueueState['tracks'][number]['info']; requesterId?: string}): QueueTrack => ({
      encoded: persisted.encoded,
      info: persisted.info,
      pluginInfo: undefined,
      requester: persisted.requesterId ? requesterMap.get(persisted.requesterId) : undefined,
      playContext: {playContext: 'restore', requestChannelId: state.textChannelId},
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
        } catch {}
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
          } catch {}
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
      } catch {}
    }

    this.logger.info(`Successfully restored queue for guild ${state.guildId}`);
    return 'restored';
  }

  public async clearSnapshot(): Promise<void> {
    try {
      await clearPlayerStates();
    } catch {}
  }
}
