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

    // 봇 자신의 voice state 변경인 경우 먼저 처리 (플레이어 체크 전에!)
    const isBotStateChange = newState.id === client.user?.id || oldState.id === client.user?.id;

    if (isBotStateChange) {
      // 봇이 음성 채널에서 완전히 나갔는지 확인 (강제 퇴장)
      if (oldState.channelId && !newState.channelId) {
        const player = client.manager.players.get(guildId);
        if (player) {
          client.logger.info(`Bot was kicked from voice channel in guild ${guild.name} (${guildId})`);
          const textChannelId = player.textChannelId;
          player.set('stoppedByCommand', true);
          try {
            player.destroy();
          } catch (error) {
            client.logger.error(`Failed to destroy player on bot kick: ${error}`);
          }
          activePlayers.delete(guildId);
          await sendMessage(guild, textChannelId, {embeds: [new EmbedBuilder().setTitle('음성 채널에서 퇴장당했어요. 음악을 정지할게요.').setColor(client.config.EMBED_COLOR_NORMAL)]});
        }
        return;
      }
      // 봇 자신의 다른 voice state 변경은 무시
      return;
    }

    // 여기서부터는 다른 멤버의 상태 변경 처리
    const player = client.manager.players.get(guildId);
    if (!player) return;

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
      const endTime = Math.floor((Date.now() + 10 * 60 * 1000) / 1000); // 10분 후 Timestamp
      const embed = new EmbedBuilder()
        .setTitle('아무도 없어서 음악을 일시정지했어요.')
        .setDescription(`<t:${endTime}:R> 후에 자동으로 연결을 종료해요.`)
        .setColor(client.config.EMBED_COLOR_NORMAL);

      const message = await sendMessage(guild, player.textChannelId, {embeds: [embed]});

      if (!activePlayers.has(guildId)) {
        const timeout = setTimeout(
          async () => {
            try {
              if (message?.editable) {
                await message.edit({embeds: [embed.setDescription('10분이 지나서 자동으로 연결을 종료했어요.')]});
              }
            } catch (editError) {
              // 메시지 편집 실패 시 무시 (채널이 캐시에 없거나 메시지가 삭제된 경우)
              client.logger.warn(`Failed to edit timeout message: ${editError}`);
            }
            player.set('stoppedByCommand', true);
            try {
              player.destroy();
            } catch (destroyError) {
              client.logger.warn(`Failed to destroy player on timeout: ${destroyError}`);
            }
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

    // 봇이 플레이어에 설정된 음성 채널에 없으면 무시
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
