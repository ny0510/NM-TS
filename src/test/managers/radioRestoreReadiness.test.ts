import {afterEach, expect, spyOn, test} from 'bun:test';
import {EventEmitter} from 'node:events';
import type {NMClient} from '@/client';
import {radioRegions} from '@/features/radio/radioStations';
import {LavalinkManager} from '@/managers/LavalinkManager';
import * as persistence from '@/managers/playerState/persistence';
import {restoreAllPlayerStates} from '@/managers/playerState/restorer';
import type {ILogger} from '@/shared/logger';
import {PLAYER_STATE_VERSION} from '@/types/playerState';

const restores: Array<() => void> = [];
afterEach(() => {
  for (const restore of restores.splice(0)) restore();
});

function setup(regionKey = 'seoul', savedRegionKey = regionKey) {
  const region = radioRegions.find(region => region.key === regionKey);
  const station = region?.stations[0];
  if (!region || !station) throw new Error('Missing station');
  const calls: string[] = [];
  const player = Object.assign(new EventEmitter(), {
    paused: false,
    setPaused: async () => {},
    setGlobalVolume: async () => {},
    playTrack: async () => {
      calls.push('play');
    },
  });
  let available = false;
  const node = {
    rest: {
      resolve: async () => {
        calls.push('resolve');
        return {loadType: 'track', data: {encoded: 'fresh', info: {identifier: 'fresh', title: '', author: '', length: 0, isStream: true, isSeekable: false, position: 0, sourceName: 'http'}, pluginInfo: undefined}};
      },
    },
  };
  const shoukaku = Object.assign(new EventEmitter(), {players: new Map(), connections: new Map(), getIdealNode: () => (available ? node : undefined), joinVoiceChannel: async () => player, leaveVoiceChannel: async () => {}});
  const logger: ILogger = Object.create(null);
  Object.assign(logger, {
    warn: () => {},
    info: () => {},
    error: () => {
      calls.push('error');
    },
    debug: () => {},
  });
  const manager: LavalinkManager = Object.create(LavalinkManager.prototype);
  Object.assign(manager, {shoukaku, queues: new Map(), radios: new Map(), locks: new Map(), musicVolumes: new Map(), client: null, logger, radioStreamResolver: async () => 'https://broadcast.example/restored.m3u8'});
  const client: NMClient = Object.create(null);
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
        throw new Error('unexpected user');
      },
    },
  });
  const load = spyOn(persistence, 'loadPlayerStates').mockResolvedValue([
    {guildId: 'guild', version: PLAYER_STATE_VERSION, state: {mode: 'radio', guildId: 'guild', voiceChannelId: 'voice', textChannelId: 'text', regionKey: savedRegionKey, stationId: station.id, volume: 20, paused: false, savedAt: 1}, createdAt: new Date(0), updatedAt: new Date(0)},
  ]);
  const clear = spyOn(persistence, 'clearPlayerStates').mockImplementation(async () => {
    calls.push('clear');
  });
  const remove = spyOn(persistence, 'deletePersistedPlayerState').mockImplementation(async id => {
    calls.push(`delete:${id}`);
  });
  restores.push(
    () => load.mockRestore(),
    () => clear.mockRestore(),
    () => remove.mockRestore(),
  );
  return {
    manager,
    client,
    calls,
    logger,
    shoukaku,
    ready: () => {
      available = true;
      shoukaku.emit('ready', 'test', false, false);
    },
  };
}

test('restart waits for node readiness before resolving radio and consumes only restored snapshot', async () => {
  const {client, calls, logger, ready} = setup();
  const restoring = restoreAllPlayerStates(client, logger);
  await Bun.sleep(3_050);
  expect(calls).toEqual([]);
  ready();
  expect(await restoring).toEqual({restored: 1, total: 1, failed: 0});
  expect(calls).toEqual(['resolve', 'play', 'delete:guild']);
});

test('failed radio restore retains its snapshot instead of clearing all records', async () => {
  const {client, manager, calls, logger, ready} = setup();
  ready();
  Object.assign(manager, {loadRadio: async () => undefined});
  await restoreAllPlayerStates(client, logger);
  expect(calls).not.toContain('clear');
  expect(calls).not.toContain('delete:guild');
});

test('node readiness timeout retains snapshots and removes its listener', async () => {
  const {client, manager, calls, logger, shoukaku} = setup();
  const wait = manager.waitForReadyNode.bind(manager);
  Object.assign(manager, {waitForReadyNode: () => wait(5)});
  expect(await restoreAllPlayerStates(client, logger)).toEqual({restored: 0, total: 1, failed: 1});
  expect(calls).toEqual([]);
  expect(shoukaku.listenerCount('ready')).toBe(0);
});

test('legacy Busan group restores Ulsan station into its new region', async () => {
  const {client, manager, logger, ready} = setup('ulsan', 'busan');
  ready();
  expect(await restoreAllPlayerStates(client, logger)).toEqual({restored: 1, total: 1, failed: 0});
  expect(manager.getRadioSession('guild')?.regionKey).toBe('ulsan');
});

test('a preparation failure is counted and retains the radio snapshot', async () => {
  const {client, manager, logger, ready, calls} = setup();
  ready();
  Object.assign(manager, {
    loadRadio: async () => {
      throw new TypeError('Broadcast API unavailable');
    },
  });

  const result = await restoreAllPlayerStates(client, logger);

  expect(result).toEqual({restored: 0, total: 1, failed: 1});
  expect(calls).toEqual(['error']);
});

test('prepares a cold radio stream before starting the per-guild restore deadline', async () => {
  const {client, manager, logger, ready, calls} = setup();
  ready();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const originalResolver = manager.loadRadio.bind(manager);
  Object.assign(manager, {
    loadRadio: async (...args: Parameters<LavalinkManager['loadRadio']>) => {
      entered.resolve();
      await release.promise;
      return originalResolver(...args);
    },
  });
  const timeout = spyOn(globalThis, 'setTimeout');
  restores.push(() => timeout.mockRestore());

  const restoring = restoreAllPlayerStates(client, logger);
  await entered.promise;
  const prematureDeadline = timeout.mock.calls.some(([, duration]) => duration === 3000);
  release.resolve();
  const result = await restoring;

  expect(prematureDeadline).toBe(false);
  expect(result).toEqual({restored: 1, total: 1, failed: 0});
  expect(calls).toEqual(['resolve', 'play', 'delete:guild']);
});
