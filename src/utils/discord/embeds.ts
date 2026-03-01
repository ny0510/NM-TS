import {type ButtonInteraction, type ChatInputCommandInteraction, EmbedBuilder, MessageFlags} from 'discord.js';

import type {NMClient} from '@/client/Client';
import {safeReply} from '@/utils/discord/interactions';

export const createErrorEmbed = (client: NMClient, title: string, description?: string): EmbedBuilder => {
  const embed = new EmbedBuilder().setTitle(title).setColor(client.config.EMBED_COLOR_ERROR);
  if (description) {
    embed.setDescription(description);
  }
  return embed;
};

export const createSuccessEmbed = (client: NMClient, title: string, description?: string): EmbedBuilder => {
  const embed = new EmbedBuilder().setTitle(title).setColor(client.config.EMBED_COLOR_NORMAL);
  if (description) {
    embed.setDescription(description);
  }
  return embed;
};

export const replyError = async (interaction: ChatInputCommandInteraction | ButtonInteraction, client: NMClient, title: string, description?: string, ephemeral: boolean = true): Promise<void> => {
  await safeReply(interaction, {
    embeds: [createErrorEmbed(client, title, description)],
    ...(ephemeral && {flags: MessageFlags.Ephemeral}),
  });
};

export const replySuccess = async (interaction: ChatInputCommandInteraction | ButtonInteraction, client: NMClient, title: string, description?: string): Promise<void> => {
  await safeReply(interaction, {
    embeds: [createSuccessEmbed(client, title, description)],
  });
};
