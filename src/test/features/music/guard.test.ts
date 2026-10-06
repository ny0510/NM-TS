import {afterEach, describe, expect, mock, spyOn, test} from 'bun:test';
import {ChatInputCommandInteraction, Client, MessageFlags} from 'discord.js';

import {command as queueCommand} from '@/commands/queue';
import {validateMusicCommand} from '@/features/music/guard';
import type {Queue} from '@/features/music/queue/Queue';

afterEach(() => {
  mock.restore();
});

let interactionNumber = 0;

function createInteraction() {
  const client = Object.assign(new Client({intents: []}), {
    queues: new Map<string, Queue>(),
    logger: {warn: () => undefined, error: () => undefined},
  });
  const post = spyOn(client.rest, 'post').mockResolvedValue({});
  const interaction: ChatInputCommandInteraction = Object.create(ChatInputCommandInteraction.prototype);
  Object.assign(interaction, {
    id: `queue-guard-${++interactionNumber}`,
    applicationId: 'application',
    token: 'test-token',
    client,
    guildId: 'guild',
    member: {voice: {channel: {id: 'voice'}}},
    deferred: false,
    replied: false,
  });
  return {client, interaction, post};
}

describe('music command responses without a queue', () => {
  test('/queue acknowledges the interaction when no music has been played', async () => {
    // Given: a member in voice and no queue for the guild
    const {interaction, post} = createInteraction();

    // When: the real /queue handler runs
    await queueCommand.execute(interaction);

    // Then: Discord receives a private no-music response
    expect(interaction.replied).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[1]?.body).toMatchObject({
      type: 4,
      data: {flags: MessageFlags.Ephemeral, embeds: [{title: '현재 재생중인 음악이 없어요.'}]},
    });
  });

  test('acknowledges a missing queue when playback is not required', async () => {
    // Given: a command using the default validation options
    const {interaction, post} = createInteraction();

    // When: its queue is validated
    const queue = await validateMusicCommand(interaction);

    // Then: validation stops with an acknowledged error
    expect(queue).toBeUndefined();
    expect(interaction.replied).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
  });

  test('/queue still asks the member to join voice before checking playback', async () => {
    // Given: no queue and a member outside voice
    const {interaction, post} = createInteraction();
    Object.assign(interaction, {member: {voice: {channel: null}}});

    // When: /queue runs
    await queueCommand.execute(interaction);

    // Then: the voice-channel guidance remains the first response
    expect(interaction.replied).toBe(true);
    expect(post.mock.calls[0]?.[1]?.body).toMatchObject({
      data: {flags: MessageFlags.Ephemeral, embeds: [{title: '음성 채널에 먼저 들어가 주세요.'}]},
    });
  });
});
