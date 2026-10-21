import {type ChatInputCommandInteraction, type MessageComponentInteraction, MessageFlags, PermissionFlagsBits} from 'discord.js';
import {getClient} from '@/shared/discord/client';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {safeReply} from '@/shared/discord/interactions';
import {isTimedOut} from '@/shared/discord/permissions/isTimedOut';
import type {CreateQueueOptions} from '@/types/music';

export type PlaybackInteraction = ChatInputCommandInteraction | MessageComponentInteraction;

export async function playbackError(interaction: PlaybackInteraction, title: string): Promise<void> {
  await safeReply(interaction, {embeds: [createErrorEmbed(getClient(interaction), title)], flags: MessageFlags.Ephemeral});
}

export async function getPlaybackOptions(interaction: PlaybackInteraction): Promise<CreateQueueOptions | undefined> {
  const client = getClient(interaction);
  const guild = interaction.guild;
  if (!guild || !interaction.channelId) return;
  const member = await guild.members.fetch(interaction.user.id).catch(() => undefined);
  const voice = member?.voice.channel;
  if (!voice) {
    await playbackError(interaction, '음성 채널에 먼저 들어가 주세요.');
    return;
  }
  const current = client.services.lavalinkManager.getSession(guild.id);
  if (current && current.voiceChannelId !== voice.id) {
    await playbackError(interaction, '봇과 같은 음성 채널에 있어야 해요.');
    return;
  }
  const bot = guild.members.me;
  if (!bot || isTimedOut(bot)) {
    await playbackError(interaction, '현재 음성 채널에 연결할 수 없어요. 봇의 타임아웃 상태를 확인해 주세요.');
    return;
  }
  const text = client.channels.cache.get(interaction.channelId);
  if (!voice.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]) || !text || text.isDMBased() || !text.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
    await playbackError(interaction, '음성 채널 연결·말하기 또는 메시지 전송 권한이 부족해요.');
    return;
  }
  return {guildId: guild.id, voiceChannelId: voice.id, textChannelId: interaction.channelId, shardId: guild.shardId, volume: client.config.DEFAULT_VOLUME, deaf: true, mute: false};
}
