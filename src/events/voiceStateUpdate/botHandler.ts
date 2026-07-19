import {VoiceState} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Queue} from '@/features/music/queue/Queue';
import {isTimedOut} from '@/shared/discord/permissions/isTimedOut';
import {destroyQueueSafely} from '@/features/music/queue/queueOperations';
import {clearActiveTimeout} from './activityManager';
import {createBotKickedEmbed, sendTextChannelMessage} from './notifications';

export function isBotStateChange(
  oldState: VoiceState,
  newState: VoiceState,
  clientUser: {id: string} | null,
): boolean {
  return newState.id === clientUser?.id || oldState.id === clientUser?.id;
}

export async function handleBotKicked(
  client: NMClient,
  guild: VoiceState['guild'],
  guildId: string,
  queue: Queue,
): Promise<void> {
  client.logger.info(`Bot was kicked from voice channel in guild ${guild.name} (${guildId})`);
  const textChannelId = queue.textChannelId;
  const botMember = guild.members.cache.get(client.user!.id);

  queue.set('stoppedByCommand', true);
  await destroyQueueSafely(client, guildId, `Bot was kicked from voice channel in guild ${guild.name} (${guildId})`);
  clearActiveTimeout(guildId);

  if (!isTimedOut(botMember)) {
    await sendTextChannelMessage(guild, textChannelId, {embeds: [createBotKickedEmbed(client)]});
  }
}
