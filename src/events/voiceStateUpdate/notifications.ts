import {EmbedBuilder, type MessageCreateOptions, TextChannel, VoiceState} from 'discord.js';

import type {NMClient} from '@/client/Client';
import {COLORS} from '@/shared/discord/embedColors';

export async function sendTextChannelMessage(
  guild: VoiceState['guild'],
  channelId: string | undefined | null,
  payload: string | MessageCreateOptions,
): Promise<ReturnType<TextChannel['send']> | undefined> {
  try {
    if (!channelId) return undefined;
    const textChannel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (!textChannel) return undefined;
    return await textChannel.send(payload);
  } catch {
    return undefined;
  }
}

export function createBotKickedEmbed(client: NMClient): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('음성 채널에서 퇴장당했어요. 음악을 정지할게요.')
    .setColor(COLORS.normal);
}

export function createPausedEmbed(client: NMClient, endTime: number): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('아무도 없어서 음악을 일시정지했어요.')
    .setDescription(`<t:${endTime}:R> 후에 자동으로 연결을 종료해요.`)
    .setColor(COLORS.normal);
}

export function createResumedEmbed(client: NMClient): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('다시 음악을 재생할게요.')
    .setColor(COLORS.normal);
}
