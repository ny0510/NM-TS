import {EmbedBuilder} from 'discord.js';

import type {NMClient} from '@/client/Client';

export const createErrorEmbed = (client: NMClient, title: string, description?: string): EmbedBuilder => {
  const embed = new EmbedBuilder().setTitle(title).setColor(client.config.EMBED_COLOR_ERROR);
  if (description) {
    embed.setDescription(description);
  }
  return embed;
};
