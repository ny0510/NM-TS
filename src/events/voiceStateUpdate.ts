import {ActivityType, EmbedBuilder, Events, GuildMember, type MessageCreateOptions, MessagePayload, PresenceUpdateStatus, TextChannel, VoiceState} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Event} from '@/client/types';

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

    const sendMessage = async (guild: VoiceState['guild'], channelId: string | undefined | null, payload: string | MessageCreateOptions) => {
      try {
        const textChannel = guild.channels.cache.get(channelId!) as TextChannel | undefined;
        if (!textChannel) return;
        return await textChannel.send(payload);
      } catch (error) {
        client.logger.error(`Failed to send message in voice state update: ${error}`);
        return;
      }
    };

    // 봇 자신의 voice state 변경인 경우 먼저 처리
    const isBotStateChange = newState.id === client.user?.id || oldState.id === client.user?.id;
    if (isBotStateChange) {
      const playerVoiceChannelId = player.voiceChannelId;
      // 봇이 음성 채널에서 나갔는지 확인 (강제 퇴장 또는 이동)
      if (oldState.channelId === playerVoiceChannelId && newState.channelId !== playerVoiceChannelId) {
        // 봇이 플레이어가 설정된 채널에서 나감
        await sendMessage(guild, player.textChannelId, {embeds: [new EmbedBuilder().setTitle('음성 채널에서 퇴장당했어요. 음악을 정지할게요.').setColor(client.config.EMBED_COLOR_NORMAL)]});
        player.set('stoppedByCommand', true);
        player.destroy();
        activePlayers.delete(guildId);
        return;
      }
      // 봇 자신의 다른 voice state 변경은 무시
      return;
    }

    // 봇이 현재 연결된 음성 채널과 플레이어의 voiceChannelId가 일치하는지 확인
    const botVoiceChannel = guild.members.me?.voice?.channel;
    const playerVoiceChannelId = player.voiceChannelId;

    // 플레이어가 설정된 음성 채널과 관련된 상태 변화가 아니면 무시
    const affectedChannelId = newState.channelId || oldState.channelId;
    if (affectedChannelId !== playerVoiceChannelId) {
      return;
    }

    const getNonBotMembers = (voiceChannel: VoiceState['channel']) => voiceChannel?.members.filter((member: GuildMember) => !member.user.bot);

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

    // 봇이 플레이어에 설정된 음성 채널에 없으면 무시 (이미 위에서 처리됨)
    if (!botVoiceChannel || botVoiceChannel.id !== playerVoiceChannelId) {
      return;
    }

    // 플레이어가 설정된 음성 채널의 멤버 수 확인
    const members = getNonBotMembers(botVoiceChannel);

    if (members?.size === 0) {
      handleEmptyChannel(guildId, guild, player);
    } else {
      handleMemberJoin(guildId, guild, player);
    }
  },
} as Event;
