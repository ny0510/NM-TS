import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, type HexColorString, LabelBuilder, MessageFlags, ModalBuilder, StringSelectMenuInteraction, TextInputBuilder, TextInputStyle} from 'discord.js';
import {LoadType} from 'shoukaku';

import type {QueueTrack} from '@/types/music';
import {safeDeferUpdate, safeEditReply, safeReply} from '@/utils/discord';
import {getClient} from '@/utils/discord/client';
import {createErrorEmbed} from '@/utils/discord/embeds';
import {hyperlink, truncateWithEllipsis} from '@/utils/formatting';
import {Logger} from '@/utils/logger';
import {FAVORITES_PER_PAGE, buildFavoritesComponents} from '@/utils/music/favorites/favoritesComponents';
import {getUserFavorites, removeFavorite} from '@/utils/music/favorites/favoritesService';
import type {FavoriteTrack} from '@/utils/music/favorites/favoritesService';
import {getEmbedMeta} from '@/utils/music/trackAdder';

const logger = new Logger('FavoritesList');

type AddResult = {title: string; uri: string | null; success: boolean; error?: string};

async function updateFavoritesList(interaction: ButtonInteraction, userId: string, page: number): Promise<void> {
  const favorites = await getUserFavorites(userId);

  await safeEditReply(interaction, {
    components: buildFavoritesComponents(favorites, page),
  });
}

function extractPageFromCustomId(customId: string, prefix: string): number {
  const match = customId.match(new RegExp(`${prefix}(-?\\d+)_`));
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

export async function handleFavoritesSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const client = getClient(interaction);
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;
  const page = extractPageFromCustomId(interaction.customId, 'fav_select_');

  if (!interaction.values || interaction.values.length === 0) {
    await interaction.reply({
      embeds: [createErrorEmbed(client, '재생할 곡을 선택해 주세요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const trackIds = interaction.values.map(v => Number.parseInt(v, 10));
  const favorites = await getUserFavorites(userId);
  const selectedFavorites = trackIds.map(id => favorites.find(f => f.trackId === id)).filter((f): f is FavoriteTrack => Boolean(f));

  if (selectedFavorites.length === 0) {
    await interaction.reply({
      embeds: [createErrorEmbed(client, '선택한 곡을 찾을 수 없어요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = interaction.guild?.members.cache.get(userId);
  const voiceChannelId = member?.voice.channelId;
  if (!voiceChannelId) {
    await interaction.reply({
      embeds: [createErrorEmbed(client, '음성 채널에 먼저 들어가 주세요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const existingQueue = client.queues.get(guildId);
  if (existingQueue && existingQueue.voiceChannelId !== voiceChannelId) {
    await interaction.reply({
      embeds: [createErrorEmbed(client, '봇과 같은 음성 채널에 있어야 해요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();

  let queue = client.queues.get(guildId);
  if (!queue) {
    try {
      queue = await client.services.lavalinkManager.createQueue({
        guildId,
        voiceChannelId,
        textChannelId: interaction.channelId!,
        shardId: 0,
        volume: client.config.DEFAULT_VOLUME,
        deaf: true,
        mute: false,
      });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(`Failed to create queue from favorites: ${error}`));
      await interaction.editReply({
        embeds: [createErrorEmbed(client, '플레이어를 생성하지 못했어요. 잠시 후 다시 시도해 주세요.')],
      });
      return;
    }
  }

  if (!queue) return;

  const addedQueueTracks: QueueTrack[] = [];
  const results: AddResult[] = [];

  for (const fav of selectedFavorites) {
    const query = fav.uri ?? `${fav.source}:${fav.identifier}`;
    try {
      const res = await client.services.lavalinkManager.search(query, interaction.user);
      if (!res || res.loadType === LoadType.EMPTY || res.loadType === LoadType.ERROR) {
        results.push({title: fav.title, uri: fav.uri, success: false, error: '음악을 찾을 수 없어요.'});
        continue;
      }

      let track: QueueTrack | undefined;
      if (res.loadType === LoadType.TRACK) {
        track = res.data as QueueTrack;
      } else if (res.loadType === LoadType.SEARCH) {
        const tracks = res.data as QueueTrack[];
        track = tracks[0];
      }

      if (!track) {
        results.push({title: fav.title, uri: fav.uri, success: false, error: '음악을 찾을 수 없어요.'});
        continue;
      }

      track.requester = interaction.user;
      track.playContext = {playContext: 'play', requestChannelId: interaction.channelId};
      queue.add(track);
      addedQueueTracks.push(track);
      results.push({title: fav.title, uri: fav.uri, success: true});
    } catch (error) {
      const errorMessage = error instanceof Error && error.message ? error.message : '알 수 없는 오류';
      logger.error(error instanceof Error ? error : new Error(`Failed to add favorite track: ${error}`));
      results.push({title: fav.title, uri: fav.uri, success: false, error: errorMessage});
    }
  }

  if (!queue.playing && !queue.paused) await queue.play();

  const refreshedFavorites = await getUserFavorites(userId);
  const totalPages = Math.max(1, Math.ceil(refreshedFavorites.length / FAVORITES_PER_PAGE));
  const validPage = Math.min(Math.max(page, 0), totalPages - 1);
  await interaction.editReply({
    components: buildFavoritesComponents(refreshedFavorites, validPage),
  });

  const description = results.map(({title, uri, success, error}) => `${success ? '☑️' : `⚠️ (${error})`} ${hyperlink(truncateWithEllipsis(title, 50), uri ?? '')}`).join('\n');

  const addedCount = results.filter(r => r.success).length;
  const firstTrackThumbnail = addedQueueTracks[0]?.info.artworkUrl ?? selectedFavorites[0]?.artworkUrl ?? null;
  const embedTitle = addedCount > 0 ? `💿 선택한 ${results.length}곡 중 ${addedCount}곡을 대기열에 추가했어요.` : '⚠️ 선택한 곡을 대기열에 추가하지 못했어요.';

  const isPlaylist = addedQueueTracks.length > 1;
  const firstAddedTrack = addedQueueTracks[0];
  const metaSource =
    firstAddedTrack ??
    (selectedFavorites[0]
      ? {
          info: {
            title: selectedFavorites[0].title,
            author: selectedFavorites[0].artist,
            length: selectedFavorites[0].durationMs,
            uri: selectedFavorites[0].uri ?? '',
            identifier: selectedFavorites[0].identifier,
            sourceName: selectedFavorites[0].source,
            artworkUrl: selectedFavorites[0].artworkUrl ?? '',
            isStream: false,
            isSeekable: true,
            position: 0,
          },
          encoded: '',
          pluginInfo: {},
        }
      : null);

  let colors: Awaited<ReturnType<typeof getEmbedMeta>>['colors'] = [];
  let footerText = '';
  if (metaSource) {
    const meta = await getEmbedMeta(isPlaylist && addedQueueTracks.length > 1 ? addedQueueTracks : (metaSource as QueueTrack), isPlaylist && addedQueueTracks.length > 1, queue);
    colors = meta.colors;
    footerText = meta.footerText;
  } else {
    footerText = `대기열에 ${queue.size()}곡`;
  }

  const resultEmbed = new EmbedBuilder()
    .setTitle(embedTitle)
    .setDescription(description || '음악을 찾을 수 없어요.')
    .setThumbnail(firstTrackThumbnail)
    .setFooter({text: footerText})
    .setColor((colors[0]?.hex?.() ?? client.config.EMBED_COLOR_NORMAL) as HexColorString);

  await interaction.followUp({
    embeds: [resultEmbed],
    ephemeral: true,
  });
}

export async function handleFavoritesPagination(interaction: ButtonInteraction): Promise<void> {
  const client = getClient(interaction);
  const userId = interaction.user.id;
  const customId = interaction.customId;

  const confirmMatch = customId.match(/^fav_remove_confirm_(-?\d+)_(-?\d+)_(.+)$/);
  if (confirmMatch?.[1] && confirmMatch[2] && confirmMatch[3]) {
    const page = Number.parseInt(confirmMatch[1], 10);
    const trackId = Number.parseInt(confirmMatch[2], 10);
    const nonce = confirmMatch[3];
    const favMsgId = interaction.message.id;
    const favorites = await getUserFavorites(userId);
    const track = favorites.find(f => f.trackId === trackId);
    const trackTitle = track ? truncateWithEllipsis(track.title, 40) : null;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`fav_remove_exec_${favMsgId}_${page}_${trackId}_${nonce}`).setLabel('삭제').setEmoji({name: '🗑️'}).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('fav_remove_cancel').setLabel('취소').setEmoji({name: '✖️'}).setStyle(ButtonStyle.Primary),
    );
    await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setColor(client.config.EMBED_COLOR_NORMAL)
          .setTitle(trackTitle ? trackTitle : '즐겨찾기 삭제 확인')
          .setDescription('정말로 즐겨찾기에서 삭제하시겠어요?\n삭제하면 되돌릴 수 없어요.'),
      ],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const execMatch = customId.match(/^fav_remove_exec_(\d+)_(-?\d+)_(-?\d+)_(.+)$/);
  if (execMatch?.[1] && execMatch[2] && execMatch[3] && execMatch[4]) {
    const favMsgId = execMatch[1];
    const page = Number.parseInt(execMatch[2], 10);
    const trackId = Number.parseInt(execMatch[3], 10);
    const deferred = await safeDeferUpdate(interaction);
    if (!deferred) return;
    const removed = await removeFavorite(userId, trackId);
    if (!removed) {
      await safeEditReply(interaction, {embeds: [createErrorEmbed(client, '즐겨찾기를 제거하지 못했어요.')], components: []});
      return;
    }
    await safeEditReply(interaction, {
      embeds: [new EmbedBuilder().setColor(client.config.EMBED_COLOR_NORMAL).setDescription('🗑️ 즐겨찾기에서 삭제했어요.')],
      components: [],
    });
    const favorites = await getUserFavorites(userId);
    const channel = interaction.channel;
    if (channel?.isTextBased()) {
      try {
        const favMessage = await channel.messages.fetch(favMsgId);
        if (favMessage) {
          await favMessage.edit({components: buildFavoritesComponents(favorites, page)});
        }
      } catch (error) {
        const code = (error as {code?: number})?.code;
        if (code === 10008) {
          logger.debug(`Favorites list message ${favMsgId} no longer exists: ${error}`);
        } else {
          logger.error(error instanceof Error ? error : new Error(`Failed to refresh favorites list after delete: ${error}`));
        }
      }
    }
    setTimeout(() => {
      interaction.deleteReply().catch((err: unknown) => {
        const code = (err as {code?: number})?.code;
        if (code === 10008) return;
        logger.debug(`Auto-delete ephemeral after delete failed: ${err}`);
      });
    }, 3000);
    return;
  }

  if (customId === 'fav_remove_cancel') {
    try {
      await interaction.update({
        embeds: [new EmbedBuilder().setColor(client.config.EMBED_COLOR_NORMAL).setDescription('❌ 삭제를 취소했어요.')],
        components: [],
      });
      setTimeout(() => {
        interaction.deleteReply().catch((err: unknown) => {
          const code = (err as {code?: number})?.code;
          if (code === 10008) return;
          logger.debug(`Auto-delete ephemeral after cancel failed: ${err}`);
        });
      }, 2000);
    } catch (error) {
      logger.debug(`Failed to update cancelled ephemeral: ${error}`);
    }
    return;
  }

  const jumpMatch = customId.match(/^fav_page_jump_(.+)$/);
  if (jumpMatch?.[1]) {
    const favorites = await getUserFavorites(userId);
    const totalPages = Math.max(1, Math.ceil(favorites.length / FAVORITES_PER_PAGE));
    const modalId = `fav_page_modal_${interaction.id}`;
    const modal = new ModalBuilder().setCustomId(modalId).setTitle('페이지 이동');
    const pageInput = new TextInputBuilder().setCustomId('fav_page_input').setStyle(TextInputStyle.Short).setPlaceholder(`1 ~ ${totalPages}`).setRequired(true);
    const pageLabel = new LabelBuilder().setLabel('이동할 페이지 번호를 입력해 주세요.').setTextInputComponent(pageInput);
    modal.addLabelComponents(pageLabel);
    await interaction.showModal(modal);

    try {
      const submitted = await interaction.awaitModalSubmit({time: 30_000, filter: mi => mi.customId === modalId});
      await submitted.deferUpdate();
      const currentFavorites = await getUserFavorites(userId);
      if (currentFavorites.length === 0) {
        await submitted.editReply({
          embeds: [createErrorEmbed(client, '즐겨찾기에 추가된 곡이 없어요.')],
          components: [],
        });
        return;
      }
      const currentTotalPages = Math.max(1, Math.ceil(currentFavorites.length / FAVORITES_PER_PAGE));
      const inputValue = parseInt(submitted.fields.getTextInputValue('fav_page_input'), 10);
      if (Number.isNaN(inputValue) || inputValue < 1 || inputValue > currentTotalPages) {
        await submitted.followUp({
          embeds: [createErrorEmbed(client, '유효하지 않은 페이지 번호예요.', `1 ~ ${currentTotalPages} 사이의 번호를 입력해 주세요.`)],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const newPage = inputValue - 1;
      await submitted.editReply({
        components: buildFavoritesComponents(currentFavorites, newPage),
      });
    } catch {
      return;
    }
    return;
  }

  const deferred = await safeDeferUpdate(interaction);
  if (!deferred) return;

  if (customId.startsWith('fav_refresh_')) {
    await updateFavoritesList(interaction, userId, 0);
    return;
  }

  const pageMatch = customId.match(/fav_page_(-?\d+)_/);
  if (!pageMatch || !pageMatch[1]) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '잘못된 페이지 요청이에요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const page = parseInt(pageMatch[1], 10);
  await updateFavoritesList(interaction, userId, page);
}
