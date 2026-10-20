import {afterEach, expect, mock, spyOn, test} from 'bun:test';
import {type ChatInputCommandInteraction, Client, InteractionCollector, type MappedInteractionTypes, Message, type MessageComponentType, type StringSelectMenuInteraction} from 'discord.js';
import {type LavalinkResponse, LoadType, type Player, type Shoukaku} from 'shoukaku';

import * as guard from '@/features/music/guard';
import {Queue} from '@/features/music/queue/Queue';
import {handleRadio} from '@/features/music/radio/radioHandler';
import * as interactions from '@/shared/discord/interactions';
import * as permissions from '@/shared/discord/permissions/checkPermissions';

afterEach(() => mock.restore());

test.each([false, true])('adds one station despite concurrent selections (retry after failure=%s)', async retryAfterFailure => {
  // Given: an active queue and a radio lookup that has not completed.
  const player: Player = Object.create(null);
  const shoukaku: Shoukaku = Object.create(null);
  const queue = new Queue({player, shoukaku, guildId: 'guild', voiceChannelId: 'voice', textChannelId: 'text'});
  queue.playing = true;
  const lookup = Promise.withResolvers<LavalinkResponse>();
  const started = Promise.withResolvers<void>();
  let attempts = 0;
  const client = Object.assign(new Client<true>({intents: []}), {
    queues: new Map([['guild', queue]]),
    services: {
      lavalinkManager: {
        search: () => {
          if (retryAfterFailure && attempts++ === 0) return Promise.resolve({loadType: LoadType.EMPTY, data: {}} satisfies LavalinkResponse);
          started.resolve();
          return lookup.promise;
        },
      },
    },
    logger: {error: () => undefined},
  });
  const collector = new InteractionCollector<MappedInteractionTypes[MessageComponentType]>(client);
  const message: Message = Object.create(Message.prototype);
  spyOn(message, 'createMessageComponentCollector').mockReturnValue(collector);
  spyOn(interactions, 'safeReply').mockResolvedValue();
  spyOn(interactions, 'safeEditReply').mockResolvedValue(true);
  spyOn(interactions, 'safeDeferUpdate').mockResolvedValue(true);
  spyOn(guard, 'ensureVoiceChannel').mockResolvedValue(true);
  spyOn(guard, 'ensureSameVoiceChannel').mockResolvedValue(true);
  spyOn(permissions, 'checkBotPermissions').mockResolvedValue({result: true, missing: []});
  const interaction: ChatInputCommandInteraction = Object.create(null);
  Object.assign(interaction, {client, user: {id: 'user'}, fetchReply: async () => message});
  await handleRadio(interaction);
  const selection: StringSelectMenuInteraction = Object.create(null);
  Object.assign(selection, {client, user: {id: 'user'}, guildId: 'guild', channelId: 'text', customId: 'radio:select:seoul', values: ['0'], isButton: () => false, isStringSelectMenu: () => true});
  const collect = collector.listeners('collect').at(-1);
  if (!collect) throw new TypeError('Missing radio collector');
  if (retryAfterFailure) await collect(selection);

  // When: two selections arrive before Lavalink responds.
  const first = collect(selection);
  await started.promise;
  const second = collect(selection);
  lookup.resolve({loadType: LoadType.TRACK, data: {encoded: 'radio', info: {identifier: 'radio', title: 'Unknown title', author: 'Unknown artist', uri: 'https://radio.bsod.kr/stream?stn=kbs&ch=1radio', isStream: true, isSeekable: false, length: 0, position: 0, sourceName: 'http'}, pluginInfo: undefined}});
  try {
    await Promise.all([first, second]);

    // Then: the picker adds a single station.
    expect(queue.size()).toBe(1);
  } finally {
    collector.stop('selected');
  }
});
