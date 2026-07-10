import {EmbedBuilder} from 'discord.js';

import type {NMClient} from '@/client/Client';
import {getColors} from '@/shared/discord/embedColors';

export const createErrorEmbed = (client: NMClient, title: string, description?: string): EmbedBuilder => {
  const embed = new EmbedBuilder().setTitle(title).setColor(getColors(client.config).error);
  if (description) {
    embed.setDescription(description);
  }
  return embed;
};
