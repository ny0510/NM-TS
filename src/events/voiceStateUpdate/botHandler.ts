import type {VoiceState} from 'discord.js';

import type {NMClient} from '@/client';
import {isTimedOut} from '@/shared/discord/permissions/isTimedOut';
import type {PlaybackSession} from '@/types/playback';
import {clearActiveTimeout} from './activityManager';
import {createBotKickedEmbed, sendTextChannelMessage} from './notifications';

export function isBotStateChange(oldState: VoiceState, newState: VoiceState, clientUser: {id: string} | null): boolean {
  return newState.id === clientUser?.id || oldState.id === clientUser?.id;
}

export async function handleBotKicked(client: NMClient, guild: VoiceState['guild'], guildId: string, queue: PlaybackSession): Promise<void> {
  client.logger.info(`Bot was kicked from voice channel in guild ${guild.name} (${guildId})`);
  const textChannelId = queue.textChannelId;
  const isRadio = queue.mode === 'radio';
  const botMember = client.user ? guild.members.cache.get(client.user.id) : undefined;

  queue.set('stoppedByCommand', true);
  if (!(await client.services.lavalinkManager.destroySession(guildId, queue.sessionId))) return;
  clearActiveTimeout(guildId);

  if (!isTimedOut(botMember)) {
    await sendTextChannelMessage(guild, textChannelId, {embeds: [createBotKickedEmbed(client, isRadio)]});
  }
}
