import {ActivityType, EmbedBuilder, Events, GuildMember, type MessageCreateOptions, MessagePayload, PresenceUpdateStatus, TextChannel, VoiceState} from 'discord.js';

import type {Event} from '@/client/types';
import type {NMClient} from '@/client/Client';

const activePlayers = new Map<string, NodeJS.Timeout>();

export default {
  name: Events.VoiceStateUpdate,
  async execute(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const client = oldState.client as NMClient;
    const guild = newState?.guild ?? oldState?.guild;
    if (!guild) return;
    const guildId = guild.id;
    const player = client.manager.players.get(guildId!);

    if (!player) return;

    const getNonBotMembers = (voiceChannel: VoiceState['channel']) => voiceChannel?.members.filter((member: GuildMember) => !member.user.bot);

    const sendMessage = async (guild: VoiceState['guild'], channelId: string | undefined, payload: string | MessageCreateOptions) => {
      const textChannel = guild.channels.cache.get(channelId!) as TextChannel | undefined;
      if (!textChannel) return;
      return await textChannel.send(payload);
    };

    const handleEmptyChannel = async (guildId: string, guild: VoiceState['guild'], player: any) => {
      if (!player.paused) player.pause(true);
      const embed = new EmbedBuilder().setTitle('아무도 없어서 음악을 일시정지했어요. 10분 후에 자동으로 연결을 종료해요.').setColor(client.config.EMBED_COLOR_NORMAL);

      const message = await sendMessage(guild, player.textChannelId, {embeds: [embed]});

      if (!activePlayers.has(guildId)) {
        const timeout = setTimeout(
          async () => {
            if (message) {
              await message.edit({embeds: [embed.setDescription('10분이 지나서 자동으로 연결을 종료했어요.')]});
            }
            player.set('stoppedByCommand', true);
            player.destroy();
            activePlayers.delete(guildId);
          },
          10 * 60 * 1000,
        );

        activePlayers.set(guildId, timeout);
      }
    };

    const handleMemberJoin = async (guildId: string, guild: VoiceState['guild'], player: any) => {
      if (player.paused) {
        await sendMessage(guild, player.textChannelId, {embeds: [new EmbedBuilder().setTitle('다시 음악을 재생할게요.').setColor(client.config.EMBED_COLOR_NORMAL)]});
        player.pause(false);
      }

      if (activePlayers.has(guildId)) {
        clearTimeout(activePlayers.get(guildId)!);
        activePlayers.delete(guildId);
      }
    };

    const handleBotKicked = async (guildId: string, guild: VoiceState['guild'], player: any) => {
      if (player) {
        await sendMessage(guild, player.textChannelId, {embeds: [new EmbedBuilder().setTitle('음성 채널에서 퇴장당했어요. 음악을 정지할게요.').setColor(client.config.EMBED_COLOR_NORMAL)]});
        player.set('stoppedByCommand', true);
        player.destroy();
        activePlayers.delete(guildId);
      }
    };

    const voiceChannel = guild.members.me?.voice?.channel;
    if (!voiceChannel) {
      return await handleBotKicked(guildId, guild, player);
    }

    const members = getNonBotMembers(voiceChannel);

    if (members?.size === 0) {
      handleEmptyChannel(guildId, guild, player);
    } else {
      handleMemberJoin(guildId, guild, player);
    }
  },
} as Event;
