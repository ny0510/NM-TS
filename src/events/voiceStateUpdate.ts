import {Events, VoiceState} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Event} from '@/types/client';
import {isBotStateChange, handleBotKicked} from './voiceStateUpdate/botHandler';
import {getNonBotMembers, handleEmptyChannel, handleMemberJoin} from './voiceStateUpdate/activityManager';

export default {
  name: Events.VoiceStateUpdate,
  async execute(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const client = oldState.client as NMClient;
    const guild = newState?.guild ?? oldState?.guild;
    if (!guild) return;
    const guildId = guild.id;

    if (isBotStateChange(oldState, newState, client.user)) {
      if (oldState.channelId && !newState.channelId) {
        const queue = client.queues.get(guildId);
        if (queue) {
          await handleBotKicked(client, guild, guildId, queue);
        }
      }
      return;
    }

    const queue = client.queues.get(guildId);
    if (!queue) return;

    const botVoiceChannel = guild.members.me?.voice?.channel;
    const queueVoiceChannelId = queue.voiceChannelId;

    const affectedChannelId = newState.channelId || oldState.channelId;
    if (affectedChannelId !== queueVoiceChannelId) return;
    if (!botVoiceChannel || botVoiceChannel.id !== queueVoiceChannelId) return;

    const members = getNonBotMembers(botVoiceChannel);

    if (members?.size === 0) {
      void handleEmptyChannel(client, guildId, guild, queue);
    } else {
      void handleMemberJoin(client, guildId, guild, queue);
    }
  },
} satisfies Event<'voiceStateUpdate'>;
