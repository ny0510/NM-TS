import {EmbedBuilder, type HexColorString, Message, MessageFlags, codeBlock} from 'discord.js';
import getColors from 'get-image-colors';
import {ManagerEventTypes, type Track} from 'magmastream';

// import {createEAutoplaymbed, handleAutoplayOnTrackStart, manageTrackHistory} from './autoplay';
import {getEmbedMeta} from './playerUtils';
import {restoreAllSessions} from './sessionManager';
import type {NMClient} from '@/client/Client';
import {config} from '@/utils/config';
import {hyperlink, msToTime, truncateWithEllipsis} from '@/utils/formatting';
import {Logger} from '@/utils/logger';

const logger = new Logger('Lavalink', config.IS_DEV_MODE ? 'debug' : 'info');

export const registerLavalinkEvents = (client: NMClient) => {
  // Debug 이벤트 활성화
  client.manager.on(ManagerEventTypes.Debug, message => logger.debug(`${message}`));

  // 노드 연결 시 저장된 세션 복원
  client.manager.on(ManagerEventTypes.NodeConnect, async node => {
    logger.info(`Node ${node.options.identifier} connected`);
    // 약간의 딜레이 후 세션 복원 (노드가 완전히 준비될 때까지)
    setTimeout(() => restoreAllSessions(client), 2000);
  });

  client.manager.on(ManagerEventTypes.NodeDisconnect, (node, reason) => logger.warn(`Node ${node.options.identifier} disconnected! Reason: ${reason.reason}`));
  client.manager.on(ManagerEventTypes.NodeError, (node, error) => logger.error(`Node ${node.options.identifier} error: ${error}`));
  client.manager.on(ManagerEventTypes.NodeReconnect, node => logger.info(`Node ${node.options.identifier} reconnecting...`));
  client.manager.on(ManagerEventTypes.NodeDestroy, node => logger.info(`Node ${node.options.identifier} destroyed`));
  client.manager.on(ManagerEventTypes.PlayerCreate, player => logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) created`));
  client.manager.on(ManagerEventTypes.PlayerDestroy, player => logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) destroyed`));

  client.manager.on(ManagerEventTypes.TrackEnd, async (player, track) => logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) track end. Track: ${track.title}`));

  client.manager.on(ManagerEventTypes.TrackStart, async (player, track: Track) => {
    logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) track start. Track: ${track.title}`);
    const channel = client.channels.cache.get(player.textChannelId || '');

    // 트랙 히스토리 관리
    // manageTrackHistory(player, track);

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
      });

    // // 자동재생 기능: 대기열이 적을 때 관련 트랙 추가
    // const autoplayResult = await handleAutoplayOnTrackStart(client, player);

    // if (autoplayResult.success && autoplayResult.addedTracks.length > 0 && channel?.isSendable()) {
    //   const embed = await createAutoplayEmbed(autoplayResult.addedTracks, player, client, '자동재생으로 관련 음악을 추가했어요!');

    //   await channel.send({
    //     embeds: [embed],
    //   });
    // } else if (!autoplayResult.success && autoplayResult.error) {
    //   // 자동재생 오류는 로깅만 하고 사용자에게 표시하지 않음
    //   logger.error(`Autoplay error for player ${player.guildId}: ${autoplayResult.error}`);
    // }
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
    // threshold는 객체일 수 있음 (예: { thresholdMs: 10000 })
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
