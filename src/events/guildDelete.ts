import {Events, type Guild} from 'discord.js';

import type {NMClient} from '@/client/Client';

export default {
  name: Events.GuildDelete,
  execute: async (guild: Guild) => {
    const client = guild.client as NMClient;

    client.logger.guildLeft(guild, client);
  },
};
