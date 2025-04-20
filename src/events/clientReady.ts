import {ActivityType, Events, PresenceUpdateStatus} from 'discord.js';

import type {Event} from '@/interfaces/Event';
import type {NMClient} from '@/structs/Client';

const updatePresence = (client: NMClient) => client.user?.setPresence({activities: [{name: `NM | ${client.manager.players.size}개의 서버에서 음악을 재생 중!`, type: ActivityType.Custom}], status: PresenceUpdateStatus.Idle});

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: NMClient): Promise<void> {
    client.manager.init(client.user!.id);
    client.registerLavalinkEvents(client);
    updatePresence(client);

    client.deployCommands().catch(e => client.logger.error(`Failed to deploy commands: ${e}`));

    client.logger.info(`Ready! Logged in as ${client.user?.tag}`);
    client.logger.info(`Loaded ${client.commands.size} commands`);
    client.logger.info(`Running on ${client.guilds.cache.size} servers with ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} members`);
    if (client.config.IS_DEV_MODE) client.logger.warn('🦔 🔪 Running in development mode!!');

    setInterval(() => updatePresence(client), 10_000);
  },
} as Event;
