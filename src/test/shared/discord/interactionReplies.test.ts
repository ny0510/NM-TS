import {expect, mock, test} from 'bun:test';
import {ChatInputCommandInteraction, Client, InteractionWebhook, MessageFlags} from 'discord.js';
import {RESTJSONErrorCodes} from 'discord-api-types/v10';
import {z} from 'zod';
import {safeReply} from '@/shared/discord/interactions/safeReply';

const messageSchema = z.object({content: z.string().optional(), flags: z.number().optional()});
const callbackSchema = z.object({type: z.literal(5), data: messageSchema});
type StoredMessage = {id: string; content: string; flags: number};
let sequence = 0;

function createDiscordTransport() {
  const messages = new Map<string, StoredMessage>();
  const requests: string[] = [];
  let pending = false;
  const originalId = '1000000000000000001';
  const missing = () => Response.json({code: RESTJSONErrorCodes.UnknownMessage, message: 'Unknown Message'}, {status: 404});
  const response = (message: StoredMessage) => Response.json({...message, channel_id: '1000000000000000002', type: 0, author: {id: '1000000000000000003', username: 'NM', discriminator: '0', avatar: null}});
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(request) {
      const path = decodeURIComponent(new URL(request.url).pathname);
      requests.push(`${request.method} ${path}`);
      if (path.includes('/interactions/')) {
        const callback = callbackSchema.parse(await request.json());
        messages.set(originalId, {id: originalId, content: '', flags: callback.data.flags ?? 0});
        pending = true;
        return new Response(null, {status: 204});
      }
      if (path.endsWith('/messages/@original')) {
        const original = messages.get(originalId);
        if (!original) return missing();
        if (request.method === 'DELETE') {
          messages.delete(originalId);
          return new Response(null, {status: 204});
        }
        if (request.method === 'GET') return response(original);
        const body = messageSchema.parse(await request.json());
        original.content = body.content ?? original.content;
        original.flags |= (body.flags ?? 0) & MessageFlags.IsComponentsV2;
        pending = false;
        return response(original);
      }
      const body = messageSchema.parse(await request.json());
      if (pending) {
        const original = messages.get(originalId);
        if (!original) return missing();
        original.content = body.content ?? '';
        pending = false;
        return response(original);
      }
      const message = {id: `10000000000000000${messages.size + 10}`, content: body.content ?? '', flags: body.flags ?? 0};
      messages.set(message.id, message);
      return response(message);
    },
  });
  const logger = {warn: mock(), error: mock(), debug: mock()};
  const client = Object.assign(new Client<true>({intents: [], rest: {api: server.url.origin, retries: 0}}), {logger});
  const interaction: ChatInputCommandInteraction = Object.assign(Object.create(ChatInputCommandInteraction.prototype), {
    client,
    id: (1000000000000000000n + BigInt(++sequence)).toString(),
    commandName: 'play',
    applicationId: '1000000000000000004',
    token: 'test-token',
    webhook: new InteractionWebhook(client, '1000000000000000004', 'test-token'),
    deferred: false,
    replied: false,
    ephemeral: null,
  });
  return {server, interaction, messages, requests, logger};
}

test.each([false, true])('completes the original deferred reply without a follow-up (private=%s)', async ephemeral => {
  const {server, interaction, messages, requests, logger} = createDiscordTransport();
  try {
    const options = ephemeral ? {flags: MessageFlags.Ephemeral as const} : {};
    await interaction.deferReply(options);

    await safeReply(interaction, {content: '완료', ...options});

    expect([...messages.values()]).toEqual([{id: '1000000000000000001', content: '완료', flags: ephemeral ? MessageFlags.Ephemeral : 0}]);
    expect(requests.filter(request => request.startsWith('PATCH '))).toHaveLength(1);
    expect(logger.error).not.toHaveBeenCalled();
  } finally {
    await server.stop(true);
  }
});

test('delivers a private error before removing its completed public placeholder', async () => {
  const {server, interaction, messages, logger} = createDiscordTransport();
  try {
    await interaction.deferReply();

    await safeReply(interaction, {content: '권한이 부족해요.', flags: MessageFlags.Ephemeral});

    expect([...messages.values()].map(({content, flags}) => ({content, flags}))).toEqual([{content: '권한이 부족해요.', flags: MessageFlags.Ephemeral}]);
    expect(logger.error).not.toHaveBeenCalled();
  } finally {
    await server.stop(true);
  }
});

test('handles a deleted original response without another callback or an error stack', async () => {
  const {server, interaction, messages, logger} = createDiscordTransport();
  try {
    await interaction.deferReply();
    await interaction.deleteReply();

    await safeReply(interaction, {content: '완료'});

    expect(messages.size).toBe(0);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  } finally {
    await server.stop(true);
  }
});
