import {ActivityType, Events, PresenceUpdateStatus} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Event} from '@/client/types';

const updatePresence = (client: NMClient) => {
  const stats = client.getStats();
  client.user?.setPresence({
    activities: [
      {
        name: `NM | ${stats.activePlayers ? `${stats.activePlayers}개의 서버에서 음악을 재생 중!` : `${stats.guilds}개의 서버에서 활동 중!`}`,
        type: ActivityType.Custom,
      },
    ],
    status: PresenceUpdateStatus.Idle,
  });
};

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: NMClient): Promise<void> {
    try {
      client.services.lavalinkManager.initialize(client.user!.id);
      client.services.lavalinkManager.registerEvents(client);

      updatePresence(client);

      await client.deployCommands();

      const stats = client.getStats();
      client.logger.info(`Ready! Logged in as ${client.user?.tag}`);
      client.logger.info(`Running on ${stats.guilds} servers with ${stats.users} members`);

      if (client.config.IS_DEV_MODE) {
        client.logger.warn('🦔 🔪 Running in development mode!!');
      }

      setInterval(() => updatePresence(client), 10_000);
    } catch (error) {
      client.logger.error(`Error in clientReady event: ${error}`);
    }
  },
} as Event;
