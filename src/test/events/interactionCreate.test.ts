import {afterEach, expect, mock, spyOn, test} from 'bun:test';
import {ApplicationCommandType, ChatInputCommandInteraction, Client, InteractionType, PermissionsBitField, SlashCommandBuilder} from 'discord.js';
import {RESTJSONErrorCodes} from 'discord-api-types/v10';
import {event} from '@/events/interactionCreate';
import {safeDeferReply, safeReply} from '@/shared/discord/interactions/safeReply';

afterEach(() => mock.restore());
let counter = 0;

test.each(['owner', 'permissions'])('acknowledges a command before a slow %s lookup can expire its token', async lookup => {
  const client = Object.assign(new Client({intents: []}), {
    logger: {warn: mock(), error: mock(), debug: mock()},
    config: {IS_DEV_MODE: false},
    services: {cooldownManager: {checkCooldown: () => ({onCooldown: false})}},
    commands: new Map(),
  });
  let expired = false;
  const interaction: ChatInputCommandInteraction = Object.assign(Object.create(ChatInputCommandInteraction.prototype), {
    id: `preflight-${++counter}`,
    client,
    commandName: 'test',
    commandType: ApplicationCommandType.ChatInput,
    type: InteractionType.ApplicationCommand,
    guildId: 'guild',
    user: {id: 'user'},
    memberPermissions: new PermissionsBitField(),
    applicationId: 'application',
    token: 'test-token',
    deferred: false,
    replied: false,
    ephemeral: null,
    webhook: {client, editMessage: mock(async () => ({id: 'response'}))},
  });
  Object.defineProperties(interaction, {
    guild: {
      value: {
        id: 'guild',
        members: {
          fetch: async () => {
            expired = !interaction.deferred;
            return {permissions: new PermissionsBitField(PermissionsBitField.All)};
          },
        },
      },
    },
    channel: {value: {isSendable: () => true}},
  });
  Object.assign(client, {
    user: {id: 'bot'},
    application: {
      owner: null,
      fetch: async () => {
        if (lookup === 'owner') expired = !interaction.deferred;
      },
    },
  });
  const post = spyOn(client.rest, 'post').mockImplementation(async () => {
    if (expired) throw Object.assign(new Error('Unknown interaction'), {code: RESTJSONErrorCodes.UnknownInteraction});
    return {};
  });
  const execute = mock(async (current: ChatInputCommandInteraction) => {
    if (!(await safeDeferReply(current))) return;
    await safeReply(current, {content: '완료'});
  });
  client.commands.set('test', {data: new SlashCommandBuilder().setName('test').setDescription('test'), permissions: lookup === 'permissions' ? [PermissionsBitField.Flags.Speak] : undefined, execute});

  await event.execute(interaction);

  expect(interaction.webhook.editMessage).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledTimes(1);
  expect(client.logger.error).not.toHaveBeenCalled();
});
