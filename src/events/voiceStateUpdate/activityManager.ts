import {type GuildMember, VoiceState} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Queue} from '@/features/music/queue/Queue';
import {destroyQueueSafely} from '@/features/music/queue/queueOperations';
import {CHANNEL_EMPTY_TIMEOUT_MS} from '@/shared/discord/constants';
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

export async function handleEmptyChannel(
  client: NMClient,
  guildId: string,
  guild: VoiceState['guild'],
  queue: Queue,
): Promise<void> {
  if (!queue.paused) await queue.pause(true);
  const endTime = Math.floor((Date.now() + CHANNEL_EMPTY_TIMEOUT_MS) / 1000);
  const embed = createPausedEmbed(client, endTime);

  const message = await sendTextChannelMessage(guild, queue.textChannelId, {embeds: [embed]});

  if (!activePlayers.has(guildId)) {
    const timeout = setTimeout(
      async () => {
        queue.set('stoppedByCommand', true);
        await destroyQueueSafely(client, guildId, `Player timeout in guild ${guild.name} (${guildId})`);
        activePlayers.delete(guildId);

        if (message?.editable) {
          try {
            await message.edit({embeds: [embed.setDescription('10분이 지나서 자동으로 연결을 종료했어요.')]});
          } catch (editError) {
            client.logger.warn(`Failed to edit timeout message: ${editError}`);
          }
        }
      },
      CHANNEL_EMPTY_TIMEOUT_MS,
    );

    activePlayers.set(guildId, timeout);
  }
}

export async function handleMemberJoin(
  client: NMClient,
  guildId: string,
  guild: VoiceState['guild'],
  queue: Queue,
): Promise<void> {
  if (queue.paused) {
    await sendTextChannelMessage(guild, queue.textChannelId, {embeds: [createResumedEmbed(client)]});
    await queue.pause(false);
  }

  clearActiveTimeout(guildId);
}
