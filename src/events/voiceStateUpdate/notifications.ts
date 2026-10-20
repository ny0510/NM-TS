import {EmbedBuilder, type MessageCreateOptions, type TextChannel, type VoiceState} from 'discord.js';

import type {NMClient} from '@/client';
import {COLORS} from '@/shared/discord/embedColors';

export async function sendTextChannelMessage(guild: VoiceState['guild'], channelId: string | undefined | null, payload: string | MessageCreateOptions): Promise<ReturnType<TextChannel['send']> | undefined> {
  try {
    if (!channelId) return undefined;
    const textChannel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (!textChannel) return undefined;
    return await textChannel.send(payload);
  } catch {
    return undefined;
  }
}

export function createBotKickedEmbed(_client: NMClient, isRadio = false): EmbedBuilder {
  return new EmbedBuilder().setTitle(isRadio ? '음성 채널에서 퇴장당했어요. 라디오를 정지할게요.' : '음성 채널에서 퇴장당했어요. 음악을 정지할게요.').setColor(COLORS.normal);
}

export function createPausedEmbed(_client: NMClient, endTime: number, isRadio = false): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(isRadio ? '아무도 없어서 라디오를 일시정지했어요.' : '아무도 없어서 음악을 일시정지했어요.')
    .setDescription(`<t:${endTime}:R>에 자동으로 연결을 종료해요.`)
    .setColor(COLORS.normal);
}

export function createResumedEmbed(_client: NMClient, isRadio = false): EmbedBuilder {
  return new EmbedBuilder().setTitle(isRadio ? '다시 라디오를 재생할게요.' : '다시 음악을 재생할게요.').setColor(COLORS.normal);
}
