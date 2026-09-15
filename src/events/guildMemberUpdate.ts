import {Events, type GuildMember} from 'discord.js';

import type {NMClient} from '@/client';
import {destroyQueueSafely} from '@/features/music/queue/queueOperations';
import {isTimedOut} from '@/shared/discord/permissions/isTimedOut';
import {toError} from '@/shared/errors';
import type {Event} from '@/types/client';

export const event = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    try {
      const client = newMember.client as NMClient;

      if (newMember.id !== client.user?.id) return;

      const wasTimedOut = isTimedOut(oldMember);
      const isTimedOutNow = isTimedOut(newMember);

      if (!wasTimedOut && isTimedOutNow) {
        const queue = client.queues.get(newMember.guild.id);

        if (queue) {
          queue.set('stoppedByCommand', true);
          await destroyQueueSafely(client, newMember.guild.id, `${newMember.user.tag} was timed out in guild ${newMember.guild.name} (${newMember.guild.id})`);
        }
      }
    } catch (error) {
      const client = newMember.client as NMClient;
      client.logger.error(toError(error, 'Error in GuildMemberUpdate event'));
    }
  },
} satisfies Event<'guildMemberUpdate'>;
