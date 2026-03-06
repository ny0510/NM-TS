import {ActivityType, Events, GatewayIntentBits, PresenceUpdateStatus} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Event} from '@/client/types';
import {truncateWithEllipsis} from '@/utils';

const updatePresence = (client: NMClient) => {
  const stats = client.getStats();

  let activityName = '';
  let activityType = ActivityType.Custom;

  if (stats.activePlayers) {
    // 재생 중인 플레이어가 있으면 랜덤으로 하나 선택
    const queues = Array.from(client.queues.values());
    const randomQueue = queues[Math.floor(Math.random() * queues.length)];
    const currentTrack = randomQueue ? randomQueue.getCurrent() : null;

    if (currentTrack) {
      activityName = truncateWithEllipsis(currentTrack.info.title, 50);
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

const checkRequiredIntents = (client: NMClient): void => {
  const requiredIntents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers];

  const clientIntents = client.options.intents;
  const missingIntents: string[] = [];

  for (const intent of requiredIntents) {
    if (typeof clientIntents === 'number') {
      if ((clientIntents & intent) !== intent) {
        missingIntents.push(GatewayIntentBits[intent]);
      }
    }
  }

  if (missingIntents.length > 0) {
    client.logger.warn('⚠️  Missing required Discord Intents! Please enable them at:');
    client.logger.warn(`   https://discord.com/developers/applications/${client.user?.id}/bot`);
    client.logger.warn(`   Missing intents: ${missingIntents.join(', ')}`);
    client.logger.warn('   Required intents:');
    client.logger.warn('   - SERVER MEMBERS INTENT (for voice state tracking)');
    client.logger.warn('   - PRESENCE INTENT is NOT required');
    client.logger.warn('   - MESSAGE CONTENT INTENT is NOT required');
  }
};

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: NMClient): Promise<void> {
    try {
      client.services.lavalinkManager.registerEvents(client);

      updatePresence(client);

      await client.deployCommands();

      const stats = client.getStats();
      client.logger.info(`Ready! Logged in as ${client.user?.tag}`);
      client.logger.info(`Running on ${stats.guilds} servers with ${stats.users} members`);

      if (client.config.IS_DEV_MODE) {
        client.logger.warn('🦔 🔪 Running in development mode!!');
      }

      checkRequiredIntents(client);

      setInterval(() => void updatePresence(client), 10_000);
    } catch (error) {
      client.logger.error(`Error in clientReady event: ${error}`);
    }
  },
} as Event;
