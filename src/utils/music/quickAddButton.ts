import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, type HexColorString, MessageFlags} from 'discord.js';
import {LoadTypes} from 'magmastream';

import {createPlayer, getEmbedMeta} from './playerUtils';
import type {NMClient} from '@/client/Client';
import {hyperlink, truncateWithEllipsis} from '@/utils/formatting';
import {Logger} from '@/utils/logger';

const logger = new Logger('QuickAdd');

/**
 * 빠른 추가 버튼 컴포넌트 생성
 */
export function createQuickAddButton(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('quick_add').setLabel('다시 추가').setEmoji('➕').setStyle(ButtonStyle.Secondary));
}

/**
 * 빠른 추가 버튼 클릭 핸들러
 */
export async function handleQuickAddButton(interaction: ButtonInteraction): Promise<void> {
  const client = interaction.client as NMClient;

  // 임베드에서 URL 가져오기
  const url = interaction.message.embeds[0]?.url;
  if (!url) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle('음악 URL을 찾을 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 사용자가 음성 채널에 있는지 확인
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  const voiceChannel = member?.voice.channel;

  if (!voiceChannel) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle('먼저 음성 채널에 들어가 주세요.').setColor(client.config.EMBED_COLOR_ERROR)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({flags: MessageFlags.Ephemeral});

  try {
    // 음악 검색
    const res = await client.manager.search(url, interaction.user);

    if (res.loadType === LoadTypes.Error || res.loadType === LoadTypes.Empty) {
      await interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('음악을 찾을 수 없어요.').setDescription('링크가 만료되었거나 접근할 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
      });
      return;
    }

    if (!('tracks' in res) || !res.tracks.length) {
      await interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('음악을 찾을 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
      });
      return;
    }

    // 플레이어 가져오기 또는 없으면 생성
    const player = client.manager.players.get(interaction.guildId!) ?? (await createPlayer(interaction));
    if (!player) return;

    // 같은 음성 채널에 있는지 확인
    if (player.voiceChannelId !== voiceChannel.id) {
      await interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('봇과 같은 음성 채널에 있어야 해요.').setColor(client.config.EMBED_COLOR_ERROR)],
      });
      return;
    }

    // 플레이리스트인지 단일 트랙인지 확인
    if (res.loadType === LoadTypes.Playlist && res.playlist) {
      const tracks = res.playlist.tracks.slice(0, 100);
      await player.queue.add(tracks);

      const queueSize = await player.queue.size();
      if (!player.playing && !player.paused && queueSize) await player.play();

      logger.info(`Quick added playlist: ${res.playlist.name} (${tracks.length} tracks) to guild ${interaction.guildId}`);

      const playlistMeta = await getEmbedMeta(tracks, true, player);
      const playlistColors = playlistMeta.colors;
      const playlistFooterText = playlistMeta.footerText;

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`📜 재생목록에 포함된 음악 ${tracks.length}곡을 대기열에 추가했어요.`)
            .setDescription(hyperlink(truncateWithEllipsis(res.playlist.name, 50), url))
            .setThumbnail(tracks[0]?.artworkUrl ?? null)
            .setFooter({text: playlistFooterText})
            .setColor((playlistColors[0]?.hex?.() ?? client.config.EMBED_COLOR_NORMAL) as HexColorString),
        ],
      });
    } else {
      const track = res.tracks[0];
      await player.queue.add(track);

      const queueSize = await player.queue.size();
      if (!player.playing && !player.paused && queueSize) await player.play();

      logger.info(`Quick added track: ${track.title} to guild ${interaction.guildId}`);

      const trackMeta = await getEmbedMeta(track, false, player, 'add');
      const colors = trackMeta.colors;
      const footerText = trackMeta.footerText;

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`💿 음악을 대기열에 추가했어요.`)
            .setDescription(hyperlink(truncateWithEllipsis(track.title, 50), track.uri))
            .setThumbnail(track.artworkUrl ?? null)
            .setFooter({text: footerText})
            .setColor((colors[0]?.hex?.() ?? client.config.EMBED_COLOR_NORMAL) as HexColorString),
        ],
      });
    }
  } catch (error) {
    logger.error(`Quick add error: ${error}`);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setTitle('음악을 추가하는 중 오류가 발생했어요.').setColor(client.config.EMBED_COLOR_ERROR)],
    });
  }
}
