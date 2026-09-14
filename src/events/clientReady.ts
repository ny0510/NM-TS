import {ActivityType, type Client, Events, GatewayIntentBits, PresenceUpdateStatus} from 'discord.js';

import type {NMClient} from '@/client';
import {deployCommands} from '@/deploy';
import {buildPresenceMessages} from '@/features/presence/messages';
import {toError} from '@/shared/errors';
import type {Event} from '@/types/client';

let presenceToggle = 0;
let presenceInterval: ReturnType<typeof setInterval> | undefined;

const updatePresence = (client: NMClient) => {
  const stats = client.getStats();
  const messages = buildPresenceMessages(client.config, stats);

  const name = messages[presenceToggle++ % messages.length];

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

export const event = {
  name: Events.ClientReady,
  runOnce: true,
  async execute(client: Client<true>): Promise<void> {
    const nmClient = client as NMClient;

    try {
      nmClient.services.lavalinkManager.registerEvents(nmClient);

      try {
        await nmClient.services.playerStateManager.restoreAll();
      } catch (error) {
        nmClient.logger.error(toError(error, 'Failed to restore player state'));
      }

      updatePresence(nmClient);

      try {
        await deployCommands({scope: nmClient.config.IS_DEV_MODE ? 'guild' : 'global', preserveRemoteCommands: true});
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        nmClient.logger.error(toError(error, 'Failed to deploy application commands'));
      }

      const stats = nmClient.getStats();
      nmClient.logger.info(`Ready! Logged in as ${nmClient.user?.tag}`);
      nmClient.logger.info(`Running on ${stats.guilds} servers with ${stats.users} members`);

      if (nmClient.config.IS_DEV_MODE) {
        nmClient.logger.warn('🦔 🔪 Running in development mode!!');
      }

      checkRequiredIntents(nmClient);

      presenceInterval = setInterval(() => void updatePresence(nmClient), nmClient.config.PRESENCE_UPDATE_INTERVAL_MS);
    } catch (error) {
      nmClient.logger.error(toError(error, 'Error in clientReady event'));
    }
  },
} satisfies Event<'clientReady'>;

export function clearPresenceInterval(): void {
  if (presenceInterval) {
    clearInterval(presenceInterval);
    presenceInterval = undefined;
  }
}
