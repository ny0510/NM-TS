import {Events, type Guild} from 'discord.js';

import type {NMClient} from '@/client/Client';

export default {
  name: Events.GuildCreate,
  execute: async (guild: Guild) => {
    const client = guild.client as NMClient;

    client.logger.guildJoined(guild, client);
  },
};
