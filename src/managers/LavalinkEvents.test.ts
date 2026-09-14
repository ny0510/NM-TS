import {expect, test} from 'bun:test';
import {EventEmitter} from 'node:events';
import type {NMClient} from '@/client';
import {LavalinkManager} from './LavalinkManager';
import {registerLavalinkEvents} from './lavalink';
import {shouldRestartRepeatedTrack} from './lavalink/trackEnd';

test('stops track repeat when the replay finishes again within five seconds', () => {
  expect(shouldRestartRepeatedTrack(10_000, 14_999)).toBe(false);
});

test('keeps track repeat after normal playback or when its start was not observed', () => {
  expect(shouldRestartRepeatedTrack(10_000, 15_000)).toBe(true);
  expect(shouldRestartRepeatedTrack(undefined, 15_000)).toBe(true);
});

test('restores a dropped Lavalink node after its final connection error', () => {
  const restored: string[] = [];
  const shoukaku = Object.assign(new EventEmitter(), {
    nodes: new Map(),
  });
  const client = {
    services: {
      lavalinkManager: {
        getShoukaku: () => shoukaku,
        restoreNode: (name: string) => restored.push(name),
      },
    },
  } as unknown as NMClient;

  registerLavalinkEvents(client);
  shoukaku.emit('error', 'Mahiro', new Error('Websocket closed before a connection was established'));

  expect(restored).toEqual(['Mahiro']);
});

test('rebinds players to a restored Lavalink node', () => {
  const oldNode = {name: 'Mahiro'};
  const newNode = {name: 'Mahiro'};
  const player = {node: oldNode};
  const nodes = new Map<string, typeof newNode>();
  const shoukaku = {
    nodes,
    players: new Map([['guild', player]]),
    addNode: () => nodes.set('Mahiro', newNode),
  };
  const manager = Object.create(LavalinkManager.prototype) as LavalinkManager;

  Object.assign(manager as object, {
    nodeOption: {name: 'Mahiro'},
    shoukaku,
    logger: {warn: () => undefined},
  });

  manager.restoreNode('Mahiro');

  expect(player.node).toBe(newNode);
});

test('notifies active queues once when Lavalink restarts and recovers', () => {
  const sentTitles: string[] = [];
  const shoukaku = Object.assign(new EventEmitter(), {
    nodes: new Map(),
  });
  const channel = {
    isSendable: () => true,
    send: (payload: {embeds: Array<{data: {title?: string}}>}) => {
      sentTitles.push(payload.embeds[0]?.data.title ?? '');
      return Promise.resolve();
    },
  };
  const client = {
    channels: {cache: new Map([['text', channel]])},
    services: {
      lavalinkManager: {
        getShoukaku: () => shoukaku,
        getQueues: () => new Map([['guild', {textChannelId: 'text'}]]),
        restoreNode: () => undefined,
      },
    },
  } as unknown as NMClient;

  registerLavalinkEvents(client);
  shoukaku.emit('ready', 'Mahiro', false, false);
  shoukaku.emit('close', 'Mahiro', 1001, 'restart');
  shoukaku.emit('reconnecting', 'Mahiro', 1, 5);
  shoukaku.emit('ready', 'Mahiro', false, true);

  expect(sentTitles).toEqual(['음악 서버가 재시작 중이에요.', '음악 서버 연결이 복구됐어요.']);
});
