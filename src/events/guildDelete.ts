import {Events, type Guild} from 'discord.js';

import type {NMClient} from '@/client';

export const event = {
  name: Events.GuildDelete,
  execute: async (guild: Guild) => {
    const client = guild.client as NMClient;

    client.logger.guildLeft(guild, client);
  },
};
