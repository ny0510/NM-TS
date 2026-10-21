import {Events, type GuildMember} from 'discord.js';

import type {NMClient} from '@/client';
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
        const queue = client.services.lavalinkManager.getSession(newMember.guild.id);

        if (queue) {
          queue.set('stoppedByCommand', true);
          await client.services.lavalinkManager.destroySession(newMember.guild.id, queue.sessionId);
        }
      }
    } catch (error) {
      const client = newMember.client as NMClient;
      client.logger.error(toError(error, 'Error in GuildMemberUpdate event'));
    }
  },
} satisfies Event<'guildMemberUpdate'>;
