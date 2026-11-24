import {afterEach, expect, mock, spyOn, test} from 'bun:test';
import {ButtonInteraction, ChatInputCommandInteraction, Client} from 'discord.js';
import {RESTJSONErrorCodes} from 'discord-api-types/v10';
import {safeDeferReply, safeDeferUpdate, safeReply} from '@/shared/discord/interactions/safeReply';

afterEach(() => mock.restore());
let counter = 0;

function createInteraction() {
  const client = Object.assign(new Client({intents: []}), {logger: {warn: mock(), error: mock(), debug: mock()}});
  const interaction: ChatInputCommandInteraction = Object.assign(Object.create(ChatInputCommandInteraction.prototype), {
    id: (1573342111607169044n + BigInt(++counter)).toString(),
    client,
    commandName: 'test',
    applicationId: 'application',
    token: 'test-token',
    deferred: false,
    replied: false,
    ephemeral: null,
  });
  return {client, interaction};
}

test.each([RESTJSONErrorCodes.UnknownInteraction, RESTJSONErrorCodes.InteractionHasAlreadyBeenAcknowledged])('does not retry an unavailable callback (code=%s)', async code => {
  const {client, interaction} = createInteraction();
  const post = spyOn(client.rest, 'post').mockRejectedValue(Object.assign(new Error('Unavailable interaction'), {code}));

  await safeReply(interaction, {content: '완료'});

  expect(post).toHaveBeenCalledTimes(1);
});

test('reuses a prior deferReply instead of acknowledging a second time', async () => {
  const {client, interaction} = createInteraction();
  const post = spyOn(client.rest, 'post').mockResolvedValue({});
  await interaction.deferReply();

  expect(await safeDeferReply(interaction)).toBe(true);
  expect(post).toHaveBeenCalledTimes(1);
});

test('reuses a prior deferUpdate instead of acknowledging a second time', async () => {
  const {client} = createInteraction();
  const interaction: ButtonInteraction = Object.assign(Object.create(ButtonInteraction.prototype), {
    id: `safe-update-${++counter}`,
    client,
    applicationId: 'application',
    token: 'test-token',
    deferred: false,
    replied: false,
  });
  const post = spyOn(client.rest, 'post').mockResolvedValue({});
  await interaction.deferUpdate();

  expect(await safeDeferUpdate(interaction)).toBe(true);
  expect(post).toHaveBeenCalledTimes(1);
});
