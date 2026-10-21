import {EmbedBuilder} from 'discord.js';
import {LoadType} from 'shoukaku';
import type {NMClient} from '@/client';
import {handleEmptyChannel} from '@/events/voiceStateUpdate/activityManager';
import {findRadioStation, radioRegions, resolveRadioRegionKey} from '@/features/radio/radioStations';
import {COLORS} from '@/shared/discord/embedColors';
import {toError} from '@/shared/errors';
import type {ILogger} from '@/shared/logger';
import type {QueueTrack} from '@/types/music';
import {type PersistedPlaybackState, type PersistedTrack, PLAYER_STATE_VERSION} from '@/types/playerState';
import {clearPlayerStates, deletePersistedPlayerState, loadPlayerStates} from './persistence';

const RESTORE_TIMEOUT_MS = 3_000;
export async function clearAllPlayerStates(): Promise<void> {
  await clearPlayerStates();
}

export function migratePlaybackState(state: PersistedPlaybackState, logger: ILogger): PersistedPlaybackState {
  if (state.mode === 'radio') return {...state, regionKey: resolveRadioRegionKey(state.regionKey, state.stationId)};
  const radio = radioRegions.flatMap(region => region.stations.map(station => ({region, station}))).find(({station}) => station.url === state.currentTrack?.info.uri);
  if (radio) {
    if (state.tracks.length) logger.warn(`Discarding legacy mixed radio queue for ${state.guildId}`);
    return {mode: 'radio', guildId: state.guildId, voiceChannelId: state.voiceChannelId, textChannelId: state.textChannelId, volume: state.volume, paused: state.currentTrack?.paused ?? false, regionKey: radio.region.key, stationId: radio.station.id, requesterId: state.currentTrack?.requesterId, savedAt: state.savedAt};
  }
  const isMusic = (track: PersistedTrack): boolean => !radioRegions.some(region => region.stations.some(station => station.url === track.info.uri));
  const tracks = state.tracks.filter(isMusic);
  const previous = state.previous.filter(isMusic);
  if (tracks.length !== state.tracks.length || previous.length !== state.previous.length) logger.warn(`Discarding legacy radio entries from music queue for ${state.guildId}`);
  return {...state, mode: 'music', tracks, previous};
}

export async function restoreAllPlayerStates(client: NMClient, logger: ILogger): Promise<{restored: number; total: number; failed: number}> {
  const result = {restored: 0, total: 0, failed: 0};
  try {
    const records = await loadPlayerStates();
    const states = records.filter(record => record.version === 1 || record.version === PLAYER_STATE_VERSION);
    result.total = states.length;
    if (states.length === 0) return result;
    if (!(await client.services.lavalinkManager.waitForReadyNode())) {
      result.failed = states.length;
      logger.warn('Lavalink readiness timed out; retaining player snapshots for the next restore attempt');
      return result;
    }
    for (const record of states) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<'timeout'>(resolve => {
          timer = setTimeout(() => {
            controller.abort();
            resolve('timeout');
          }, RESTORE_TIMEOUT_MS);
        });
        const outcome = await Promise.race([restorePlaybackState(client, migratePlaybackState(record.state, logger), controller.signal), timeout]);
        if (outcome === 'restored') {
          result.restored++;
          await deletePersistedPlayerState(record.guildId);
        }
        if (outcome === 'timeout') result.failed++;
      } catch (error) {
        result.failed++;
        logger.error(toError(error, `Failed to restore guild ${record.guildId}`));
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  } catch (error) {
    logger.error(toError(error, 'Failed to restore player state'));
  }
  return result;
}

export async function restorePlaybackState(client: NMClient, state: PersistedPlaybackState, signal: AbortSignal): Promise<'restored' | 'skipped'> {
  const manager = client.services.lavalinkManager;
  const guild = client.guilds.cache.get(state.guildId);
  const voice = client.channels.cache.get(state.voiceChannelId);
  const text = client.channels.cache.get(state.textChannelId);
  if (!guild || !voice?.isVoiceBased() || !text?.isSendable() || manager.getSession(state.guildId) || signal.aborted) return 'skipped';
  const ids = state.mode === 'radio' ? [state.requesterId] : [state.currentTrack?.requesterId, state.autoplayRequesterId, ...state.tracks.map(t => t.requesterId), ...state.previous.map(t => t.requesterId)];
  const users = new Map<string, Awaited<ReturnType<typeof client.users.fetch>>>();
  await Promise.allSettled(
    [...new Set(ids)]
      .filter((id): id is string => Boolean(id))
      .map(async id => {
        users.set(id, await client.users.fetch(id));
      }),
  );
  if (signal.aborted) return 'skipped';
  const regionKey = state.mode === 'radio' ? resolveRadioRegionKey(state.regionKey, state.stationId) : undefined;
  const station = state.mode === 'radio' && regionKey ? findRadioStation(regionKey, state.stationId) : undefined;
  const resolved = station ? await manager.loadRadio(station.url, state.mode === 'radio' && state.requesterId ? users.get(state.requesterId) : undefined) : undefined;
  if (state.mode === 'radio' && (!station || resolved?.loadType !== LoadType.TRACK)) return 'skipped';
  if (signal.aborted) return 'skipped';
  return manager.runWithSessionLock(state.guildId, async scope => {
    if (signal.aborted || scope.getSession()) return 'skipped';
    const options = {guildId: state.guildId, voiceChannelId: state.voiceChannelId, textChannelId: state.textChannelId, shardId: guild.shardId, volume: state.volume};
    const session = state.mode === 'radio' ? await scope.createRadioSession(options) : await scope.createQueue(options);
    try {
      signal.throwIfAborted();
      if (state.mode === 'radio') {
        const radio = scope.getRadioSession();
        if (!radio || !station || !regionKey || resolved?.loadType !== LoadType.TRACK) throw new Error('Radio restore lost station');
        const track: QueueTrack = {...resolved.data, info: {...resolved.data.info, title: station.name, author: station.provider, uri: station.url, isStream: true}, requester: state.requesterId ? users.get(state.requesterId) : undefined};
        await radio.tune(regionKey, station, track);
        signal.throwIfAborted();
        if (state.paused) await radio.pause(true);
      } else {
        const queue = scope.getQueue();
        if (!queue) throw new Error('Music restore lost queue');
        queue.set('isRestoring', true);
        const makeTrack = (track: PersistedTrack): QueueTrack => ({encoded: track.encoded, info: track.info, pluginInfo: undefined, requester: track.requesterId ? users.get(track.requesterId) : undefined, playContext: {playContext: 'restore', requestChannelId: state.textChannelId}});
        queue.previous = state.previous.map(makeTrack);
        queue.add(state.tracks.map(makeTrack));
        queue.setTrackRepeat(state.repeatMode === 'track');
        queue.setQueueRepeat(state.repeatMode === 'queue');
        queue.setAutoplay(state.autoplay, state.autoplayRequesterId ? users.get(state.autoplayRequesterId) : undefined);
        queue.setAutoShuffle(state.autoShuffle);
        if (state.currentTrack) {
          queue.setCurrent(makeTrack(state.currentTrack));
          await queue.player.playTrack({track: {encoded: state.currentTrack.encoded}});
          signal.throwIfAborted();
          queue.playing = true;
          if (state.currentTrack.position > 0 && !state.currentTrack.info.isStream) await queue.seek(state.currentTrack.position);
          signal.throwIfAborted();
          await queue.pause(state.currentTrack.paused);
        } else if (queue.size()) await queue.play();
        signal.throwIfAborted();
        await queue.setVolume(state.volume);
        queue.set('isRestoring', false);
      }
      signal.throwIfAborted();
      if (voice.members.filter(member => !member.user.bot).size === 0) await handleEmptyChannel(client, state.guildId, guild, session);
      signal.throwIfAborted();
      await text
        .send({
          embeds: [
            new EmbedBuilder()
              .setTitle('NM이 재시작되어 이전 재생 상태를 복구했어요.')
              .setDescription(session.mode === 'radio' ? '라디오를 다시 연결했어요.' : '음악을 이어서 재생할게요.')
              .setColor(COLORS.normal),
          ],
        })
        .catch(() => undefined);
      signal.throwIfAborted();
    } catch (error) {
      await scope.destroySession(session.sessionId);
      if (signal.aborted) return 'skipped';
      throw error;
    }
    return 'restored';
  });
}
