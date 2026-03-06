import {Events, type GuildMember} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Event} from '@/client/types';
import {destroyQueueSafely} from '@/utils/music/playerUtils';

export default {
  name: Events.GuildMemberUpdate,
  async execute(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    try {
      const client = newMember.client as NMClient;

      if (newMember.id !== client.user?.id) return;

      const wasTimedOut = oldMember.communicationDisabledUntil !== null && oldMember.communicationDisabledUntil > new Date();
      const isTimedOut = newMember.communicationDisabledUntil !== null && newMember.communicationDisabledUntil > new Date();

      if (!wasTimedOut && isTimedOut) {
        const queue = client.queues.get(newMember.guild.id);

        if (queue) {
          queue.set('stoppedByCommand', true);
          await destroyQueueSafely(client, newMember.guild.id, `${newMember.user.tag} was timed out in guild ${newMember.guild.name} (${newMember.guild.id})`);
        }
      }
    } catch (error) {
      const client = newMember.client as NMClient;
      client.logger.error(`Error in GuildMemberUpdate event: ${error}`);
    }
  },
} as Event;
