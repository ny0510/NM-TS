import {EmbedBuilder, type HexColorString, Message, MessageFlags, codeBlock} from 'discord.js';
import {ManagerEventTypes, type Track} from 'magmastream';

import {getEmbedMeta} from './playerUtils';
import {createQuickAddButton} from './quickAddButton';
import type {NMClient} from '@/client/Client';
import {hyperlink, truncateWithEllipsis} from '@/utils/formatting';
import {Logger} from '@/utils/logger';

const logger = new Logger('Lavalink');

export const registerLavalinkEvents = (client: NMClient) => {
  // Debug 이벤트 활성화
  client.manager.on(ManagerEventTypes.Debug, message => logger.debug(`${message}`));

  client.manager.on(ManagerEventTypes.NodeConnect, async node => logger.info(`Node ${node.options.identifier} connected`));

  client.manager.on(ManagerEventTypes.NodeDisconnect, (node, reason) => logger.warn(`Node ${node.options.identifier} disconnected! Reason: ${reason.reason}`));
  client.manager.on(ManagerEventTypes.NodeError, (node, error) => logger.error(`Node ${node.options.identifier} error: ${error}`));
  client.manager.on(ManagerEventTypes.NodeReconnect, node => logger.info(`Node ${node.options.identifier} reconnecting...`));
  client.manager.on(ManagerEventTypes.NodeDestroy, node => logger.info(`Node ${node.options.identifier} destroyed`));
  client.manager.on(ManagerEventTypes.PlayerCreate, player => logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) created`));
  client.manager.on(ManagerEventTypes.PlayerDestroy, player => logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) destroyed`));
  client.manager.on(ManagerEventTypes.PlayerMove, (player, oldChannelId, newChannelId) => logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) moved from ${oldChannelId} to ${newChannelId}`));
  client.manager.on(ManagerEventTypes.PlayerRestored, async player => {
    const textChannel = client.channels.cache.get(player.textChannelId || '');

    // 음성 채널 유효성 확인
    if (player.voiceChannelId) {
      try {
        const voiceChannel = await client.channels.fetch(player.voiceChannelId);
        if (!voiceChannel || !voiceChannel.isVoiceBased()) {
          logger.warn(`Voice channel ${player.voiceChannelId} no longer exists or is not accessible, destroying player`);
          if (textChannel?.isSendable()) {
            await textChannel.send({
              embeds: [new EmbedBuilder().setTitle('⚠️ 세션 복원 실패').setDescription('이전에 사용하던 음성 채널이 더 이상 존재하지 않아요.').setColor(client.config.EMBED_COLOR_ERROR)],
            });
          }
          player.set('stoppedByCommand', true);
          player.destroy();
          return;
        }
      } catch {
        // 채널을 가져올 수 없음 (삭제됨 또는 권한 없음)
        logger.warn(`Failed to fetch voice channel ${player.voiceChannelId}, destroying player`);
        if (textChannel?.isSendable()) {
          await textChannel.send({
            embeds: [new EmbedBuilder().setTitle('⚠️ 세션 복원 실패').setDescription('이전에 사용하던 음성 채널에 접근할 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
          });
        }
        player.set('stoppedByCommand', true);
        player.destroy();
        return;
      }
    } else {
      // voiceChannelId가 없으면 플레이어 삭제
      logger.warn(`Player ${player.guildId} has no voice channel, destroying player`);
      if (textChannel?.isSendable()) {
        await textChannel.send({
          embeds: [new EmbedBuilder().setTitle('⚠️ 세션 복원 실패').setDescription('음성 채널 정보가 없어 세션을 복원할 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
        });
      }
      player.set('stoppedByCommand', true);
      player.destroy();
      return;
    }

    if (!textChannel?.isSendable()) return;

    logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) restored from previous session`);
    await textChannel.send({
      embeds: [new EmbedBuilder().setTitle('🔄 세션이 복원되었어요!').setDescription('이전 세션에서 재생을 이어갈게요.').setColor(client.config.EMBED_COLOR_NORMAL)],
    });
  });

  client.manager.on(ManagerEventTypes.TrackEnd, async (player, track) => logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) track end. Track: ${track.title}`));

  client.manager.on(ManagerEventTypes.TrackStart, async (player, track: Track) => {
    logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) track start. Track: ${track.title}`);
    const channel = client.channels.cache.get(player.textChannelId || '');

    const trackMeta = await getEmbedMeta(track, false, player, 'play');
    const footerText = trackMeta.footerText;
    const isRepeating = player.queueRepeat || player.trackRepeat;

    if (channel?.isSendable() && !isRepeating)
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setDescription(`♪ ${hyperlink(truncateWithEllipsis(track.title, 50), track.uri)}`)
            .setFooter({text: footerText})
            .setColor(client.config.EMBED_COLOR_NORMAL),
        ],
        components: [createQuickAddButton(track.uri)],
      });
  });

  client.manager.on(ManagerEventTypes.TrackError, async (player, track, error) => {
    const trackTitle = track?.title ?? 'Unknown Track';
    const errorMessage = error?.exception?.message ?? 'Unknown Error';
    logger.error(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) track error. Track: ${trackTitle} Error: ${errorMessage}`);

    const channel = client.channels.cache.get(player.textChannelId || '');
    if (!channel?.isSendable()) return;

    try {
      await channel.send({
        embeds: [new EmbedBuilder().setTitle('음악 재생 중 오류가 발생했어요.').setDescription(codeBlock('js', errorMessage)).setColor(client.config.EMBED_COLOR_ERROR)],
      });
    } catch (sendError) {
      logger.error(`Failed to send track error message: ${sendError}`);
    }
  });

  client.manager.on(ManagerEventTypes.TrackStuck, async (player, track, threshold) => {
    const trackTitle = track?.title ?? 'Unknown Track';
    const thresholdMs = typeof threshold === 'object' ? ((threshold as any)?.thresholdMs ?? 10000) : Number(threshold) || 10000;
    logger.warn(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) track stuck. Track: ${trackTitle} Threshold: ${thresholdMs}ms`);

    const channel = client.channels.cache.get(player.textChannelId || '');
    if (!channel?.isSendable()) return;

    try {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`음악이 ${thresholdMs / 1000}초 동안 재생되지 않았어요.`)
            .setDescription('다음 음악으로 넘어갈게요.')
            .setColor(client.config.EMBED_COLOR_ERROR),
        ],
      });
    } catch (sendError) {
      logger.error(`Failed to send track stuck message: ${sendError}`);
    }

    player.stop();
  });

  client.manager.on(ManagerEventTypes.QueueEnd, async player => {
    logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) queue end`);
    const channel = client.channels.cache.get(player.textChannelId || '');

    if (!channel?.isSendable()) return;
    if (player.get('stoppedByCommand')) return;

    const embed = new EmbedBuilder().setTitle('대기열에 있는 음악을 모두 재생했어요. 30초 후에 자동으로 연결을 종료해요.').setColor(client.config.EMBED_COLOR_NORMAL);
    let message: Message | undefined;

    try {
      message = await channel.send({embeds: [embed]});
    } catch (sendError) {
      logger.warn(`Failed to send queue end message: ${sendError}`);
    }

    setTimeout(async () => {
      try {
        const queueSize = await player.queue.size();
        if (!player.playing && queueSize === 0) {
          player.destroy();
          logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) destroyed after 30 seconds of inactivity`);

          if (message?.editable) {
            await message.edit({embeds: [embed.setDescription('30초가 지나 자동으로 연결을 종료했어요.')]});
          }
        }
      } catch (error) {
        // 메시지가 이미 삭제되었거나 채널이 캐시에 없는 경우 무시
        logger.warn(`Failed to edit queue end message: ${error}`);
      }
    }, 30_000);
  });
};
