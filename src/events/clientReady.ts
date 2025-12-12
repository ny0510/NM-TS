import {ActivityType, Events, PresenceUpdateStatus} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Event} from '@/client/types';
import {truncateWithEllipsis} from '@/utils';

const updatePresence = async (client: NMClient) => {
  const stats = client.getStats();

  let activityName = '';
  let activityType = ActivityType.Custom;

  if (stats.activePlayers) {
    // 재생 중인 플레이어가 있으면 랜덤으로 하나 선택
    const players = Array.from(client.manager.players.values());
    const randomPlayer = players[Math.floor(Math.random() * players.length)];
    const currentTrack = randomPlayer ? await randomPlayer.queue.getCurrent() : null;

    if (currentTrack) {
      activityName = truncateWithEllipsis(currentTrack.title, 50);
      activityType = ActivityType.Listening;
    } else {
      activityName = `NM | ${stats.guilds}개의 서버에서 활동 중!`;
    }
  } else {
    activityName = `NM | ${stats.guilds}개의 서버에서 활동 중!`;
  }

  client.user?.setPresence({
    activities: [
      {
        name: activityName,
        type: activityType,
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

      setInterval(() => void updatePresence(client), 10_000);
    } catch (error) {
      client.logger.error(`Error in clientReady event: ${error}`);
    }
  },
} as Event;
