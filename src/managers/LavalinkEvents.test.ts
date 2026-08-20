import {expect, test} from 'bun:test';
import {EventEmitter} from 'node:events';

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
