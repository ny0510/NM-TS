import {expect, test} from 'bun:test';
import {EventEmitter} from 'node:events';
import type {Guild} from 'discord.js';
import type {NMClient} from '@/client';
import {handleMemberJoin} from '@/events/voiceStateUpdate/activityManager';
import {radioRegions} from '@/features/radio/radioStations';
import {LavalinkManager} from '@/managers/LavalinkManager';
import {registerRadioEvents} from '@/managers/lavalink/radioEvents';
import {migratePlaybackState, restorePlaybackState} from '@/managers/playerState/restorer';
import {serializeRadioState} from '@/managers/playerState/serializer';
import type {ILogger} from '@/shared/logger';
import type {QueueTrack} from '@/types/music';
import type {PersistedQueueState} from '@/types/playerState';

const selectedStation = radioRegions[0]?.stations[0];
if (!selectedStation) throw new Error('Missing radio fixture');
const station = selectedStation;
const track = (encoded: string): QueueTrack => ({encoded, info: {identifier: encoded, title: station.name, author: station.provider, uri: station.url, length: 0, isStream: true, isSeekable: false, position: 0, sourceName: 'http'}, pluginInfo: undefined});
const options = {guildId: 'guild', voiceChannelId: 'voice', textChannelId: 'text', shardId: 0};
function fixture() {
  const calls: string[] = [];
  const player = Object.assign(new EventEmitter(), {
    paused: false,
    position: 0,
    playTrack: async (input: {track: {encoded: string}}) => {
      calls.push(input.track.encoded);
    },
    setGlobalVolume: async () => {},
    setPaused: async (state: boolean) => {
      player.paused = state;
    },
  });
  const shoukaku = {
    players: new Map(),
    connections: new Map(),
    joinVoiceChannel: async () => {
      calls.push('join');
      return player;
    },
    leaveVoiceChannel: async () => {
      calls.push('leave');
    },
  };
  const manager: LavalinkManager = Object.create(LavalinkManager.prototype);
  Object.assign(manager, {shoukaku, queues: new Map(), radios: new Map(), locks: new Map(), client: null});
  return {manager, player, calls};
}

test('concurrent radio creation has one owner and never enters music queue', async () => {
  const {manager, calls} = fixture();
  const [first, second] = await Promise.all([manager.createRadioSession(options), manager.createRadioSession(options)]);
  expect(first).toBe(second);
  expect(calls).toEqual(['join']);
  expect(manager.getQueues().size).toBe(0);
  await expect(manager.createQueue(options)).rejects.toThrow('Radio session is active');
  expect(calls).toEqual(['join']);
});

test('stale destroy cannot disconnect replacement session', async () => {
  const {manager, calls} = fixture();
  const radio = await manager.createRadioSession(options);
  await manager.destroySession('guild', radio.sessionId);
  const music = await manager.createQueue(options);
  expect(await manager.destroySession('guild', radio.sessionId)).toBe(false);
  expect(manager.getSession('guild')).toBe(music);
  expect(calls).toEqual(['join', 'leave', 'join']);
});

test('radio ignores older tune generation and stale track failures; current failure reports once', async () => {
  const {manager, player, calls} = fixture();
  const radio = await manager.createRadioSession(options);
  const titles: string[] = [];
  const client: NMClient = Object.create(null);
  Object.assign(client, {
    services: {lavalinkManager: manager},
    logger: {error: () => {}},
    channels: {
      cache: new Map([
        [
          'text',
          {
            isSendable: () => true,
            send: async (payload: {embeds: Array<{data: {title?: string}}>}) => {
              titles.push(payload.embeds[0]?.data.title ?? '');
            },
          },
        ],
      ]),
    },
  });
  registerRadioEvents(radio, client);
  const old = radio.beginTune();
  const current = radio.beginTune();
  expect(await radio.tune('seoul', station, track('old'), old)).toBe(false);
  expect(await radio.tune('seoul', station, track('new'), current)).toBe(true);
  player.emit('end', {reason: 'finished', track: track('old')});
  await manager.runWithSessionLock('guild', async () => {});
  expect(manager.getRadioSession('guild')).toBe(radio);
  player.emit('end', {reason: 'finished', track: track('new')});
  player.emit('stuck', {track: track('new')});
  await manager.runWithSessionLock('guild', async () => {});
  expect(manager.getSession('guild')).toBeUndefined();
  expect(titles).toEqual(['라디오 연결이 끊겼어요.']);
  expect(calls.filter(call => call === 'leave')).toHaveLength(1);
  expect(calls).not.toContain('old');
});

test('radio snapshot saves stable station identity without signed encoding or duration', async () => {
  const {manager} = fixture();
  const radio = await manager.createRadioSession(options);
  await radio.tune('seoul', station, track('temporary-signed-encoding'));
  const state = serializeRadioState(radio);
  expect(state?.stationId).toBe(station.id);
  expect(JSON.stringify(state)).not.toContain('temporary-signed-encoding');
  expect(JSON.stringify(state)).not.toContain('encoded');
});

test('legacy mixed radio snapshot migrates to dedicated radio', () => {
  const logger: ILogger = Object.create(null);
  Object.assign(logger, {warn: () => {}});
  const state: PersistedQueueState = {...options, currentTrack: {...track('old'), position: 900, paused: true}, tracks: [track('pending')], previous: [], repeatMode: 'track', autoplay: true, autoShuffle: true, volume: 20, savedAt: 1};
  const migrated = migratePlaybackState(state, logger);
  expect(migrated.mode).toBe('radio');
  expect('tracks' in migrated).toBe(false);
});

test('aborted restore waiting for voice join cleans its own session without starting audio', async () => {
  const {manager, player, calls} = fixture();
  let finishJoin: (() => void) | undefined;
  const joined = new Promise<void>(resolve => {
    finishJoin = resolve;
  });
  const shoukaku = manager.getShoukaku();
  Object.assign(shoukaku, {
    joinVoiceChannel: async () => {
      await joined;
      return player;
    },
  });
  const client: NMClient = Object.create(null);
  const voice = {isVoiceBased: () => true};
  const text = {isSendable: () => true};
  Object.assign(client, {
    services: {lavalinkManager: manager},
    guilds: {cache: new Map([['guild', {shardId: 0}]])},
    channels: {
      cache: new Map<string, unknown>([
        ['voice', voice],
        ['text', text],
      ]),
    },
    users: {
      fetch: async () => {
        throw new Error('unexpected user fetch');
      },
    },
  });
  const state: PersistedQueueState = {...options, currentTrack: {...track('music'), position: 0, paused: false}, tracks: [], previous: [], repeatMode: 'off', autoplay: false, autoShuffle: false, volume: 20, savedAt: 1};
  const abort = new AbortController();
  const restoring = restorePlaybackState(client, state, abort.signal);
  await Bun.sleep(1);
  abort.abort();
  finishJoin?.();
  expect(await restoring).toBe('skipped');
  expect(manager.getSession('guild')).toBeUndefined();
  expect(calls).toEqual(['leave']);
});

test('radio restore resolves the station again and never seeks its old stream', async () => {
  const {manager, player, calls} = fixture();
  const client: NMClient = Object.create(null);
  const resolved: string[] = [];
  Object.assign(manager, {
    loadRadio: async (url: string) => {
      resolved.push(url);
      return {loadType: 'track', data: track('fresh-encoding')};
    },
  });
  Object.assign(player, {
    seekTo: async () => {
      calls.push('seek');
    },
  });
  Object.assign(client, {
    services: {lavalinkManager: manager},
    guilds: {cache: new Map([['guild', {shardId: 0}]])},
    channels: {
      cache: new Map<string, unknown>([
        ['voice', {isVoiceBased: () => true, members: {filter: () => ({size: 1})}}],
        ['text', {isSendable: () => true, send: async () => {}}],
      ]),
    },
    users: {
      fetch: async () => {
        throw new Error('unexpected requester');
      },
    },
  });
  const state = {mode: 'radio' as const, ...options, regionKey: 'seoul', stationId: station.id, volume: 20, paused: true, savedAt: 1};
  expect(await restorePlaybackState(client, state, new AbortController().signal)).toBe('restored');
  expect(resolved).toEqual([station.url]);
  expect(calls).toEqual(['join', 'fresh-encoding']);
  expect(manager.getRadioSession('guild')?.paused).toBe(true);
  expect(manager.getQueues().size).toBe(0);
});

test('member join preserves manually paused radio', async () => {
  const {manager} = fixture();
  const radio = await manager.createRadioSession(options);
  await radio.pause(true);
  const client: NMClient = Object.create(null);
  Object.assign(client, {services: {lavalinkManager: manager}});
  const guild: Guild = Object.create(null);
  await handleMemberJoin(client, 'guild', guild, radio);
  expect(radio.paused).toBe(true);
});

test('failed radio tune restores the currently audible station metadata', async () => {
  const {manager, player} = fixture();
  const radio = await manager.createRadioSession(options);
  const original = track('playing');
  await radio.tune('seoul', station, original);
  Object.assign(player, {
    playTrack: async () => {
      throw new Error('load rejected');
    },
  });
  const replacement = {...station, id: 'replacement', name: 'Replacement'};
  await expect(radio.tune('jeju', replacement, track('rejected'))).rejects.toThrow('load rejected');
  expect(radio.regionKey).toBe('seoul');
  expect(radio.station).toBe(station);
  expect(radio.getCurrent()).toBe(original);
  expect(radio.playing).toBe(true);
});

test.each(['radio', 'music'] as const)('throwing %s cleanup still disconnects and clears its registry', async mode => {
  const {manager, calls} = fixture();
  const session = mode === 'radio' ? await manager.createRadioSession(options) : await manager.createQueue(options);
  let secondCleanup = false;
  session.onCleanup(() => {
    throw new Error('cleanup failed');
  });
  session.onCleanup(() => {
    secondCleanup = true;
  });
  await expect(manager.destroySession('guild', session.sessionId)).rejects.toThrow(AggregateError);
  expect(secondCleanup).toBe(true);
  expect(manager.getSession('guild')).toBeUndefined();
  expect(calls).toEqual(['join', 'leave']);
});

test('radio terminal voice close cleans only its own session and ignores transient close', async () => {
  const {manager, player, calls} = fixture();
  const radio = await manager.createRadioSession(options);
  const client: NMClient = Object.create(null);
  Object.assign(client, {services: {lavalinkManager: manager}, channels: {cache: new Map()}, logger: {error: () => {}}});
  registerRadioEvents(radio, client);
  player.emit('closed', {code: 1006});
  await manager.runWithSessionLock('guild', async () => {});
  expect(manager.getSession('guild')).toBe(radio);
  const oldClose = player.listeners('closed')[0];
  player.emit('closed', {code: 4014});
  await manager.runWithSessionLock('guild', async () => {});
  expect(manager.getSession('guild')).toBeUndefined();
  const music = await manager.createQueue(options);
  oldClose?.({code: 4014});
  await manager.runWithSessionLock('guild', async () => {});
  expect(manager.getSession('guild')).toBe(music);
  expect(calls).toEqual(['join', 'leave', 'join']);
});
