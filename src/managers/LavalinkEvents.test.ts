import {expect, test} from 'bun:test';
import {EventEmitter} from 'node:events';

import {registerLavalinkEvents} from './lavalink';
import type {NMClient} from '@/client/Client';

test('reconnects a disconnected Lavalink node', () => {
  let attempts = 0;
  const shoukaku = Object.assign(new EventEmitter(), {
    nodes: new Map([
      [
        'Mahiro',
        {
          connect: async () => {
            attempts++;
          },
        },
      ],
    ]),
  });
  const client = {services: {lavalinkManager: {getShoukaku: () => shoukaku}}} as unknown as NMClient;

  registerLavalinkEvents(client);
  shoukaku.emit('disconnect', 'Mahiro', 0);

  expect(attempts).toBe(1);
});
