import {EmbedBuilder, type Client} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {QueueTrack} from '@/types/music';
import {PLAYER_STATE_VERSION, type PersistedQueueState} from '@/types/playerState';
import type {ILogger} from '@/shared/logger';
import {clearPlayerStates, loadPlayerStates} from './persistence';
import {CHANNEL_EMPTY_TIMEOUT_MS} from '@/shared/discord/constants';
import {getColors} from '@/shared/discord/embedColors';
import {toError} from '@/shared/errors';

const RESTORE_TIMEOUT_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function clearAllPlayerStates(): Promise<void> {
  try {
    await clearPlayerStates();
  } catch {}
}

export async function restoreAllPlayerStates(client: Client, logger: ILogger): Promise<{restored: number; total: number; failed: number}> {
  const result = {restored: 0, total: 0, failed: 0};

  try {
    const states = await loadPlayerStates();

    const validStates = states.filter(state => state.version === PLAYER_STATE_VERSION).map(state => state.state);
    const skippedStates = states.length - validStates.length;

    if (states.length === 0) {
      logger.info('No persisted player state found, skipping restore');
      return result;
    }

    if (skippedStates > 0) {
      logger.warn(`Skipped ${skippedStates} player state record(s) due to version mismatch.`);
    }

    result.total = validStates.length;
    logger.info(`Restoring player state for ${result.total} guild(s)`);

    for (const state of validStates) {
      try {
        const restored = await Promise.race([restoreQueueFromState(client, state, logger), sleep(RESTORE_TIMEOUT_MS)]);
        if (restored === 'restored') {
          result.restored++;
        } else if (restored === 'skipped') {
          logger.debug(`Skipped restore for guild ${state.guildId}`);
        } else {
          result.failed++;
          logger.warn(`Restore timed out or failed for guild ${state.guildId}`);
        }
      } catch (error) {
        result.failed++;
        logger.error(toError(error, `Failed to restore guild ${state.guildId}`));
      }
    }

    await clearPlayerStates();
    logger.info(`Restore complete: ${result.restored}/${result.total} succeeded, ${result.failed} failed`);
  } catch (error) {
    logger.error(toError(error, 'Failed to restore player state'));
  }

  return result;
}

async function restoreQueueFromState(client: Client, state: PersistedQueueState, logger: ILogger): Promise<'restored' | 'skipped'> {
  const nmClient = client as unknown as NMClient;

  const guild = nmClient.guilds.cache.get(state.guildId);
  if (!guild) {
    logger.debug(`Guild ${state.guildId} not found in cache, skipping restore`);
    return 'skipped';
  }

  const voiceChannel = nmClient.channels.cache.get(state.voiceChannelId);
  const textChannel = nmClient.channels.cache.get(state.textChannelId);
  if (!voiceChannel?.isVoiceBased() || !textChannel?.isSendable()) {
    logger.debug(`Channels not found for guild ${state.guildId}, skipping restore`);
    return 'skipped';
  }

  let queue: import('@/features/music/queue/Queue').Queue;
  try {
    queue = await nmClient.services.lavalinkManager.createQueue({
      guildId: state.guildId,
      voiceChannelId: state.voiceChannelId,
      textChannelId: state.textChannelId,
      shardId: guild.shardId,
      volume: state.volume,
    });
  } catch (error) {
    logger.error(toError(error, `Failed to create queue for guild ${state.guildId}`));
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
      logger.info(`Restored queue for guild ${state.guildId} is in empty channel, pausing`);

      if (textChannel?.isSendable()) {
        try {
          const endTime = Math.floor((Date.now() + CHANNEL_EMPTY_TIMEOUT_MS) / 1000);
          await textChannel.send({
            embeds: [new EmbedBuilder().setTitle('아무도 없어서 음악을 일시정지했어요.').setDescription(`<t:${endTime}:R> 후에 자동으로 연결을 종료해요.`).setColor(getColors(nmClient.config).normal)],
          });
        } catch {}
      }
    }
  }

  if (textChannel?.isSendable()) {
    try {
      const isPaused = state.currentTrack?.paused ?? false;
      const embed = new EmbedBuilder()
        .setTitle('NM이 재시작되어 이전 재생 상태를 복구했어요.')
        .setDescription(isPaused ? '일시정지 상태로 복구되었어요.' : '음악을 이어서 재생할게요.')
        .setColor(getColors(nmClient.config).normal);

      await textChannel.send({embeds: [embed]});
    } catch {}
  }

  logger.info(`Successfully restored queue for guild ${state.guildId}`);
  return 'restored';
}
