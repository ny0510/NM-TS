import {EmbedBuilder, type HexColorString, Message, MessageFlags, codeBlock} from 'discord.js';
import getColors from 'get-image-colors';
import {ManagerEventTypes, type Track} from 'magmastream';

import {addRelatedTracksToQueue, checkAndAddAutoplayTracks, createAutoplayEmbed, getEmbedMeta} from './playerUtils';
import type {NMClient} from '@/client/Client';
import {hyperlink, msToTime, truncateWithEllipsis} from '@/utils/formatting';
import {Logger} from '@/utils/logger';

const logger = new Logger('Lavalink');

export const registerLavalinkEvents = (client: NMClient) => {
  client.manager.on(ManagerEventTypes.NodeConnect, node => logger.info(`Node ${node.options.identifier} connected`));
  client.manager.on(ManagerEventTypes.NodeDisconnect, (node, reason) => logger.warn(`Node ${node.options.identifier} disconnected! Reason: ${reason.reason}`));
  client.manager.on(ManagerEventTypes.NodeError, (node, error) => logger.error(`Node ${node.options.identifier} error: ${error}`));
  client.manager.on(ManagerEventTypes.NodeReconnect, node => logger.info(`Node ${node.options.identifier} reconnecting...`));
  client.manager.on(ManagerEventTypes.NodeDestroy, node => logger.info(`Node ${node.options.identifier} destroyed`));
  client.manager.on(ManagerEventTypes.PlayerCreate, player => logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) created`));
  client.manager.on(ManagerEventTypes.PlayerDestroy, player => logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) destroyed`));
  client.manager.on(ManagerEventTypes.TrackEnd, async (player, track) => logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) track end. Track: ${track.title}`));

  client.manager.on(ManagerEventTypes.TrackStart, async (player, track) => {
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
      });

    // 자동재생 기능: 대기열이 적을 때 관련 트랙 추가
    try {
      const autoplayResult = await checkAndAddAutoplayTracks(client, player);

      if (autoplayResult.added && autoplayResult.addedTracks.length > 0 && channel?.isSendable()) {
        const embed = await createAutoplayEmbed(autoplayResult.addedTracks, player, client, '자동재생으로 관련 음악을 추가했어요!');

        await channel.send({
          embeds: [embed],
        });
      }
    } catch (error) {
      // 자동재생 오류는 로깅만 하고 사용자에게 표시하지 않음
      logger.error(`Autoplay error for player ${player.guildId}: ${error}`);
    }
  });

  client.manager.on(ManagerEventTypes.TrackError, async (player, track, error) => {
    logger.error(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) track error. Track: ${track.title} Error: ${error.exception?.message}`);
    const channel = client.channels.cache.get(player.textChannelId || '');
    if (!channel?.isSendable()) return;

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('음악 재생 중 오류가 발생했어요.')
          .setDescription(codeBlock('js', `${error.exception?.message}`))
          .setColor(client.config.EMBED_COLOR_ERROR),
      ],
    });
  });

  client.manager.on(ManagerEventTypes.TrackStuck, async (player, track, threshold) => {
    logger.warn(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) track stuck. Track: ${track.title} Threshold: ${threshold}`);
    const channel = client.channels.cache.get(player.textChannelId || '');
    if (!channel?.isSendable()) return;

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`음악이 ${Number(threshold) / 1000}초 동안 재생되지 않았어요.`)
          .setDescription('다음 음악으로 넘어갈게요.')
          .setColor(client.config.EMBED_COLOR_ERROR),
      ],
    });

    player.stop();
  });

  client.manager.on(ManagerEventTypes.QueueEnd, async player => {
    logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) queue end`);
    const channel = client.channels.cache.get(player.textChannelId || '');

    if (!channel?.isSendable()) return;
    if (player.get('stoppedByCommand')) return;

    const embed = new EmbedBuilder().setTitle('대기열에 있는 음악을 모두 재생했어요. 30초 후에 자동으로 연결을 종료해요.').setColor(client.config.EMBED_COLOR_NORMAL);
    let message: Message | undefined = await channel.send({embeds: [embed]});

    setTimeout(async () => {
      if (!player.playing && player.queue.size === 0) {
        player.destroy();
        logger.info(`Player ${client.guilds.cache.get(player.guildId)?.name} (${player.guildId}) destroyed after 30 seconds of inactivity`);
        await message.edit({embeds: [embed.setDescription('30초가 지나 자동으로 연결을 종료했어요.')]});
      }
    }, 30_000);
  });
};
