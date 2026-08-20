import {expect, test} from 'bun:test';
import {EventEmitter} from 'node:events';

import {LavalinkManager} from './LavalinkManager';
import {registerLavalinkEvents} from './lavalink';
import type {NMClient} from '@/client/Client';

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
