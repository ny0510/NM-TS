import {ButtonInteraction, ChatInputCommandInteraction, GuildMember, MessageFlags, PermissionFlagsBits, channelMention, codeBlock} from 'discord.js';

import type {Queue} from '@/structures/Queue';
import {formatMissingPermissions, slashCommandMention} from '@/utils/discord';
import {getClient} from '@/utils/discord/client';
import {createErrorEmbed} from '@/utils/discord/embeds';
import {safeReply} from '@/utils/discord/interactions';

export const ensureVoiceChannel = async (interaction: ChatInputCommandInteraction): Promise<boolean> => {
  const client = getClient(interaction);
  const member = interaction.member as GuildMember;

  if (!member.voice?.channel) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '음성 채널에 먼저 들어가 주세요.')],
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  return true;
};

export const ensureSameVoiceChannel = async (interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<boolean> => {
  const client = getClient(interaction);
  const member = interaction.member as GuildMember;
  const queue = client.queues.get(interaction.guildId!);

  if (queue && member.voice.channel?.id !== queue.voiceChannelId) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '해당 명령어를 실행하기 위해서는 같은 음성 채널에 있어야 해요.', `${channelMention(queue.voiceChannelId || '')} 음성 채널에 들어가 주세요.`)],
      flags: MessageFlags.Ephemeral,
    });

    return false;
  }

  return true;
};

export const ensurePlaying = async (interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<boolean> => {
  const client = getClient(interaction);
  const queue = client.queues.get(interaction.guildId!);
  const currentTrack = queue ? queue.getCurrent() : null;

  if (!queue || (!queue.playing && !queue.paused) || !currentTrack) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '현재 재생중인 음악이 없어요.', `${await slashCommandMention(interaction, 'play')} 명령어로 음악을 재생할 수 있어요.`)],
      flags: MessageFlags.Ephemeral,
    });

    return false;
  }

  return true;
};

export const ensurePlayerReady = async (interaction: ChatInputCommandInteraction | ButtonInteraction, options?: {requirePlaying?: boolean}): Promise<boolean> => {
  if (interaction.isChatInputCommand() && !(await ensureVoiceChannel(interaction))) return false;
  if (!(await ensureSameVoiceChannel(interaction))) return false;
  if (options?.requirePlaying && !(await ensurePlaying(interaction))) return false;

  const client = getClient(interaction);
  const queue = client.queues.get(interaction.guildId!);
  if (!queue) return false;

  return true;
};

export const createQueue = async (interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<Queue | undefined> => {
  const client = getClient(interaction);
  const member = interaction.member as GuildMember;
  const channel = client.channels.cache.get(interaction.channelId);

  if (!channel || channel.isDMBased()) return;

  const guild = client.guilds.cache.get(interaction.guildId!);
  const botMember = guild?.members.me;

  const isTimedOut = botMember?.communicationDisabledUntil !== null && botMember?.communicationDisabledUntil !== undefined && botMember.communicationDisabledUntil > new Date();
  if (isTimedOut) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '현재 타임아웃 상태라서 음성 채널에 들어갈 수 없어요.', '타임아웃이 해제된 후 다시 시도해 주세요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const botPermissions = channel.permissionsFor(botMember!);

  const requiredPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];
  const missingPermissions = requiredPermissions.filter(perm => !botPermissions?.has(perm));

  if (missingPermissions.length) {
    const missingText = formatMissingPermissions(missingPermissions);
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '명령어를 실행하기 위해 필요한 권한이 부족해요. 아래 권한을 추가해 주세요.', codeBlock('diff', missingText))],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const queue = await client.services.lavalinkManager.createQueue({
      guildId: interaction.guildId!,
      voiceChannelId: member.voice.channel!.id,
      textChannelId: interaction.channelId,
      shardId: interaction.guild?.shardId ?? 0,
      volume: client.config.DEFAULT_VOLUME,
      deaf: true,
      mute: false,
    });
    return queue;
  } catch (e) {
    client.logger.error(e instanceof Error ? e : new Error(`Failed to create queue: ${e}`));
    let errorMessage = '플레이어를 생성하는 중 오류가 발생했어요.';
    let errorDescription = '';

    if (e instanceof Error) {
      if (e.message.includes('User limit')) {
        errorMessage = '음성 채널이 가득 찼어요.';
        errorDescription = '다른 음성 채널을 이용해 주세요.';
      } else if (client.config.IS_DEV_MODE) {
        errorDescription = codeBlock('js', e.message);
      }
    }

    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, errorMessage, errorDescription)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
};

export const ensurePaused = async (interaction: ChatInputCommandInteraction): Promise<boolean> => {
  const client = getClient(interaction);
  const queue = client.queues.get(interaction.guildId!);
  if (!queue || queue.paused) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '음악이 이미 일시정지 상태에요.', `${await slashCommandMention(interaction, 'resume')} 명령어로 다시 재생할 수 있어요.`)],
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
};

export const ensureResumed = async (interaction: ChatInputCommandInteraction): Promise<boolean> => {
  const client = getClient(interaction);
  const queue = client.queues.get(interaction.guildId!);
  if (!queue || !queue.paused) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '음악이 이미 재생중이에요.', `${await slashCommandMention(interaction, 'pause')} 명령어로 일시 정지할 수 있어요.`)],
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
};
