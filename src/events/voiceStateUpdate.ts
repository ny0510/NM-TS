import {ActivityType, EmbedBuilder, Events, GuildMember, type MessageCreateOptions, MessagePayload, PresenceUpdateStatus, TextChannel, VoiceState} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Event} from '@/client/types';
import type {Queue} from '@/structures/Queue';
import {destroyQueueSafely} from '@/utils/music/playerUtils';

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
        client.logger.warn(`Failed to send message in voice state update: ${error}`);
        return;
      }
    };

    // 봇 자신의 voice state 변경인 경우 먼저 처리 (플레이어 체크 전에!)
    const isBotStateChange = newState.id === client.user?.id || oldState.id === client.user?.id;

    if (isBotStateChange) {
      if (oldState.channelId && !newState.channelId) {
        const queue = client.queues.get(guildId);
        if (queue) {
          client.logger.info(`Bot was kicked from voice channel in guild ${guild.name} (${guildId})`);
          const textChannelId = queue.textChannelId;

          const botMember = guild.members.cache.get(client.user!.id);
          const isTimedOut = botMember?.communicationDisabledUntil !== null && botMember?.communicationDisabledUntil !== undefined && botMember.communicationDisabledUntil > new Date();

          queue.set('stoppedByCommand', true);
          await destroyQueueSafely(client, guildId, `Bot was kicked from voice channel in guild ${guild.name} (${guildId})`);
          activePlayers.delete(guildId);

          if (!isTimedOut) {
            await sendMessage(guild, textChannelId, {embeds: [new EmbedBuilder().setTitle('음성 채널에서 퇴장당했어요. 음악을 정지할게요.').setColor(client.config.EMBED_COLOR_NORMAL)]});
          }
        }
        return;
      }
      return;
    }

    // 여기서부터는 다른 멤버의 상태 변경 처리
    const queue = client.queues.get(guildId);
    if (!queue) return;

    // 봇이 현재 연결된 음성 채널과 플레이어의 voiceChannelId가 일치하는지 확인
    const botVoiceChannel = guild.members.me?.voice?.channel;
    const queueVoiceChannelId = queue.voiceChannelId;

    // 플레이어가 설정된 음성 채널과 관련된 상태 변화가 아니면 무시
    const affectedChannelId = newState.channelId || oldState.channelId;
    if (affectedChannelId !== queueVoiceChannelId) {
      return;
    }

    const getNonBotMembers = (voiceChannel: VoiceState['channel']) => voiceChannel?.members.filter((member: GuildMember) => !member.user.bot);

    const handleEmptyChannel = async (guildId: string, guild: VoiceState['guild'], queue: Queue) => {
      if (!queue.paused) await queue.pause(true);
      const endTime = Math.floor((Date.now() + 10 * 60 * 1000) / 1000);
      const embed = new EmbedBuilder().setTitle('아무도 없어서 음악을 일시정지했어요.').setDescription(`<t:${endTime}:R> 후에 자동으로 연결을 종료해요.`).setColor(client.config.EMBED_COLOR_NORMAL);

      const message = await sendMessage(guild, queue.textChannelId, {embeds: [embed]});

      if (!activePlayers.has(guildId)) {
        const timeout = setTimeout(
          async () => {
            queue.set('stoppedByCommand', true);
            await destroyQueueSafely(client, guildId, `Player timeout in guild ${guild.name} (${guildId})`);
            activePlayers.delete(guildId);

            if (message?.editable) {
              try {
                await message.edit({embeds: [embed.setDescription('10분이 지나서 자동으로 연결을 종료했어요.')]});
              } catch (editError) {
                client.logger.warn(`Failed to edit timeout message: ${editError}`);
              }
            }
          },
          10 * 60 * 1000,
        );

        activePlayers.set(guildId, timeout);
      }
    };

    const handleMemberJoin = async (guildId: string, guild: VoiceState['guild'], queue: Queue) => {
      if (queue.paused) {
        await sendMessage(guild, queue.textChannelId, {embeds: [new EmbedBuilder().setTitle('다시 음악을 재생할게요.').setColor(client.config.EMBED_COLOR_NORMAL)]});
        await queue.pause(false);
      }

      if (activePlayers.has(guildId)) {
        clearTimeout(activePlayers.get(guildId)!);
        activePlayers.delete(guildId);
      }
    };

    // 봇이 플레이어에 설정된 음성 채널에 없으면 무시
    if (!botVoiceChannel || botVoiceChannel.id !== queueVoiceChannelId) {
      return;
    }

    // 플레이어가 설정된 음성 채널의 멤버 수 확인
    const members = getNonBotMembers(botVoiceChannel);

    if (members?.size === 0) {
      handleEmptyChannel(guildId, guild, queue);
    } else {
      handleMemberJoin(guildId, guild, queue);
    }
  },
} as Event;
