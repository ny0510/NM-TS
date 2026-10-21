import type {GuildMember, VoiceState} from 'discord.js';

import type {NMClient} from '@/client';
import {CHANNEL_EMPTY_TIMEOUT_MS} from '@/shared/discord/constants';
import type {PlaybackSession} from '@/types/playback';
import {createPausedEmbed, createResumedEmbed, sendTextChannelMessage} from './notifications';

const activePlayers = new Map<string, NodeJS.Timeout>();

export function clearActiveTimeout(guildId: string): void {
  const timeout = activePlayers.get(guildId);
  if (timeout) {
    clearTimeout(timeout);
    activePlayers.delete(guildId);
  }
}

export function getNonBotMembers(voiceChannel: VoiceState['channel']) {
  return voiceChannel?.members.filter((member: GuildMember) => !member.user.bot);
}

export async function handleEmptyChannel(client: NMClient, guildId: string, guild: VoiceState['guild'], queue: PlaybackSession): Promise<void> {
  if (client.services.lavalinkManager.getSession(guildId) !== queue || activePlayers.has(guildId)) return;
  if (!queue.paused) {
    queue.set('pausedForEmptyChannel', true);
    await queue.pause(true);
  }
  const endTime = Math.floor((Date.now() + CHANNEL_EMPTY_TIMEOUT_MS) / 1000);
  const embed = createPausedEmbed(client, endTime, queue.mode === 'radio');

  const message = await sendTextChannelMessage(guild, queue.textChannelId, {embeds: [embed]});
  if (client.services.lavalinkManager.getSession(guildId) !== queue) return;
  const voiceChannel = guild.channels.cache.get(queue.voiceChannelId);
  if (voiceChannel?.isVoiceBased() && voiceChannel.members.some(member => !member.user.bot)) {
    await handleMemberJoin(client, guildId, guild, queue);
    return;
  }

  if (!activePlayers.has(guildId)) {
    const timeout = setTimeout(async () => {
      queue.set('stoppedByCommand', true);
      const destroyed = await client.services.lavalinkManager.runWithSessionLock(guildId, async scope => {
        if (scope.getSession() !== queue || activePlayers.get(guildId) !== timeout) return false;
        return scope.destroySession(queue.sessionId);
      });
      if (!destroyed) return;

      if (message?.editable) {
        try {
          const disconnectedAt = Math.floor(Date.now() / 1000);
          await message.edit({embeds: [embed.setDescription(`<t:${disconnectedAt}:f>에 자동으로 연결을 종료했어요.`)]});
        } catch (editError) {
          client.logger.warn(`Failed to edit timeout message: ${editError}`);
        }
      }
    }, CHANNEL_EMPTY_TIMEOUT_MS);

    activePlayers.set(guildId, timeout);
    queue.onCleanup(() => {
      if (activePlayers.get(guildId) === timeout) clearActiveTimeout(guildId);
    });
  }
}

export async function handleMemberJoin(client: NMClient, guildId: string, guild: VoiceState['guild'], queue: PlaybackSession): Promise<void> {
  if (client.services.lavalinkManager.getSession(guildId) !== queue) return;
  clearActiveTimeout(guildId);
  if (queue.paused && queue.get('pausedForEmptyChannel')) {
    queue.set('pausedForEmptyChannel', false);
    await queue.pause(false);
    await sendTextChannelMessage(guild, queue.textChannelId, {embeds: [createResumedEmbed(client, queue.mode === 'radio')]});
  }
}
