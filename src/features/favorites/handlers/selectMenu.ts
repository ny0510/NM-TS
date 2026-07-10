import {EmbedBuilder, type HexColorString, MessageFlags, StringSelectMenuInteraction} from 'discord.js';
import {LoadType} from 'shoukaku';

import type {QueueTrack} from '@/types/music';
import {safeDeferUpdate, safeEditReply, safeReply} from '@/shared/discord';
import {getClient} from '@/shared/discord/client';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {getColors} from '@/shared/discord/embedColors';
import {toError} from '@/shared/errors';
import {hyperlink, truncateWithEllipsis} from '@/shared/formatting';
import {Logger} from '@/shared/logger';
import {FAVORITES_PER_PAGE, buildFavoritesComponents} from '@/features/favorites/component';
import {getUserFavorites} from '@/features/favorites/service';
import type {FavoriteTrack} from '@/features/favorites/service';
import {getEmbedMeta} from '@/features/music/track/embeds';

const logger = new Logger('FavoritesList');

type AddResult = {title: string; uri: string | null; success: boolean; error?: string};

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
      logger.error(toError(error, 'Failed to create queue from favorites'));
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
      logger.error(toError(error, 'Failed to add favorite track'));
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
    .setColor((colors[0]?.hex?.() ?? getColors(client.config).normal) as HexColorString);

  await interaction.followUp({
    embeds: [resultEmbed],
    ephemeral: true,
  });
}
