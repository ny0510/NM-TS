import {EmbedBuilder} from 'discord.js';

import type {NMClient} from '@/client/Client';
import {COLORS} from '@/shared/discord/embedColors';

export const createErrorEmbed = (client: NMClient, title: string, description?: string): EmbedBuilder => {
  const embed = new EmbedBuilder().setTitle(title).setColor(COLORS.error);
  if (description) {
    embed.setDescription(description);
  }
  return embed;
};
