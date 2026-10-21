import {expect, test} from 'bun:test';

import {LavalinkManager} from '@/managers/LavalinkManager';

test('disconnects a timed-out Discord voice session before retrying', async () => {
  const packets: Array<{shardId: number; payload: unknown; important: boolean}> = [];
  let attempts = 0;
  const shoukaku = {
    connections: new Map(),
    players: new Map(),
    connector: {
      sendPacket: (shardId: number, payload: unknown, important: boolean) => packets.push({shardId, payload, important}),
    },
    joinVoiceChannel: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('The voice connection is not established in 15 seconds');
      return {};
    },
    leaveVoiceChannel: async () => undefined,
  };
  const manager: LavalinkManager = Object.create(LavalinkManager.prototype);
  Reflect.set(manager, 'shoukaku', shoukaku);
  Reflect.set(manager, 'logger', {warn: () => undefined});
  Reflect.set(manager, 'queues', new Map());
  Reflect.set(manager, 'radios', new Map());
  Reflect.set(manager, 'locks', new Map());
  Reflect.set(manager, 'client', null);

  await manager.createQueue({
    guildId: 'guild',
    voiceChannelId: 'voice',
    textChannelId: 'text',
    shardId: 2,
  });

  expect(packets).toEqual([
    {
      shardId: 2,
      important: false,
      payload: {
        op: 4,
        d: {
          guild_id: 'guild',
          channel_id: null,
          self_deaf: false,
          self_mute: false,
        },
      },
    },
  ]);
});
