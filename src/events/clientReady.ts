import {ActivityType, type Client, Events, GatewayIntentBits, PresenceUpdateStatus} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Event} from '@/types/client';

let presenceToggle = false;
let presenceInterval: ReturnType<typeof setInterval> | undefined;

const updatePresence = (client: NMClient) => {
  const stats = client.getStats();

  const messages = [`NM | ${stats.guilds}개의 서버에서 활동 중!`];

  if (stats.activePlayers) {
    messages.push(`NM | ${stats.activePlayers}개의 서버에서 음악 재생 중!`);
  }

  const name = messages.length > 1 ? messages[presenceToggle ? 1 : 0] : messages[0];
  presenceToggle = !presenceToggle;

  client.user?.setPresence({
    activities: [{name: name ?? messages[0] ?? '', type: ActivityType.Custom}],
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
  async execute(client: Client<true>): Promise<void> {
    const nmClient = client as NMClient;

    try {
      nmClient.services.lavalinkManager.registerEvents(nmClient);

      try {
        await nmClient.services.playerStateManager.restoreAll();
      } catch (error) {
        nmClient.logger.error(error instanceof Error ? error : new Error(`Failed to restore player state: ${error}`));
      }

      updatePresence(nmClient);

      await nmClient.deployCommands();

      const stats = nmClient.getStats();
      nmClient.logger.info(`Ready! Logged in as ${nmClient.user?.tag}`);
      nmClient.logger.info(`Running on ${stats.guilds} servers with ${stats.users} members`);

      if (nmClient.config.IS_DEV_MODE) {
        nmClient.logger.warn('🦔 🔪 Running in development mode!!');
      }

      checkRequiredIntents(nmClient);

      presenceInterval = setInterval(() => void updatePresence(nmClient), 10_000);
    } catch (error) {
      nmClient.logger.error(error instanceof Error ? error : new Error(`Error in clientReady event: ${error}`));
    }
  },
} satisfies Event<'clientReady'>;

export function clearPresenceInterval(): void {
  if (presenceInterval) {
    clearInterval(presenceInterval);
    presenceInterval = undefined;
  }
}
