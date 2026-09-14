import {EmbedBuilder} from 'discord.js';

import type {NMClient} from '@/client';
import {COLORS} from '@/shared/discord/embedColors';

export const createErrorEmbed = (_client: NMClient, title: string, description?: string): EmbedBuilder => {
  const embed = new EmbedBuilder().setTitle(title).setColor(COLORS.error);
  if (description) {
    embed.setDescription(description);
  }
  return embed;
};
