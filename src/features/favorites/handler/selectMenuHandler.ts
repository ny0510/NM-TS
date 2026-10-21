import {EmbedBuilder, type HexColorString, type MessageComponentInteraction, MessageFlags, type StringSelectMenuInteraction} from 'discord.js';
import {LoadType} from 'shoukaku';
import {buildFavoritesComponents, FAVORITES_PER_PAGE} from '@/features/favorites/componentBuilder';
import type {FavoriteTrack} from '@/features/favorites/service';
import {getUserFavorites} from '@/features/favorites/service';
import {getEmbedMeta} from '@/features/music/track/embeds';
import {getClient} from '@/shared/discord/client';
import {COLORS} from '@/shared/discord/embedColors';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {safeReply} from '@/shared/discord/interactions';
import {toError} from '@/shared/errors';
import {hyperlink, truncateWithEllipsis} from '@/shared/formatting';
import {Logger} from '@/shared/logger';
import {requestPlaybackAction} from '@/shared/playback/switchHandler';
import type {QueueTrack} from '@/types/music';

const logger = new Logger('FavoritesList');

type AddResult = {title: string; uri: string | null; success: boolean; error?: string};

function extractPageFromCustomId(customId: string, prefix: string): number {
  const match = customId.match(new RegExp(`${prefix}(-?\\d+)_`));
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

async function refreshSelectionAndShowError(interaction: MessageComponentInteraction, client: ReturnType<typeof getClient>, favorites: Awaited<ReturnType<typeof getUserFavorites>>, page: number, errorMessage: string): Promise<void> {
  const totalPages = Math.max(1, Math.ceil(favorites.length / FAVORITES_PER_PAGE));
  const validPage = Math.min(Math.max(page, 0), totalPages - 1);
  await interaction.update({components: buildFavoritesComponents(favorites, validPage, Date.now().toString(36))});
  await interaction.followUp({embeds: [createErrorEmbed(client, errorMessage)], flags: MessageFlags.Ephemeral});
}

export async function handleFavoritesSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const client = getClient(interaction);
  const userId = interaction.user.id;
  const page = extractPageFromCustomId(interaction.customId, 'fav_select_');

  const favorites = await getUserFavorites(userId);

  if (!interaction.values || interaction.values.length === 0) {
    await refreshSelectionAndShowError(interaction, client, favorites, page, '재생할 곡을 선택해 주세요.');
    return;
  }

  const trackIds = interaction.values.map(v => Number.parseInt(v, 10));
  const selectedFavorites = trackIds.map(id => favorites.find(f => f.trackId === id)).filter((f): f is FavoriteTrack => Boolean(f));

  if (selectedFavorites.length === 0) {
    await refreshSelectionAndShowError(interaction, client, favorites, page, '선택한 곡을 찾을 수 없어요.');
    return;
  }

  await addFavoritesToQueue(interaction, selectedFavorites, page);
}

export async function addFavoritesToQueue(interaction: MessageComponentInteraction, selectedFavorites: FavoriteTrack[], page: number): Promise<void> {
  const client = getClient(interaction);
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  const textChannelId = interaction.channelId;
  if (!guildId || !textChannelId) return;

  const member = interaction.guild?.members.cache.get(userId);
  const voiceChannelId = member?.voice.channelId;
  if (!voiceChannelId) {
    await refreshSelectionAndShowError(interaction, client, await getUserFavorites(userId), page, '음성 채널에 먼저 들어가 주세요.');
    return;
  }

  const existingQueue = client.queues.get(guildId);
  if (existingQueue && existingQueue.voiceChannelId !== voiceChannelId) {
    await refreshSelectionAndShowError(interaction, client, await getUserFavorites(userId), page, '봇과 같은 음성 채널에 있어야 해요.');
    return;
  }

  await interaction.deferUpdate();

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
      addedQueueTracks.push(track);
      results.push({title: fav.title, uri: fav.uri, success: true});
    } catch (error) {
      const errorMessage = error instanceof Error && error.message ? error.message : '알 수 없는 오류';
      logger.error(toError(error, 'Failed to add favorite track'));
      results.push({title: fav.title, uri: fav.uri, success: false, error: errorMessage});
    }
  }

  if (!addedQueueTracks.length) {
    await safeReply(interaction, {embeds: [createErrorEmbed(client, '선택한 음악을 찾을 수 없어요.')], components: []});
    return;
  }
  await requestPlaybackAction(interaction, 'music', async (currentInteraction, context, options) => {
    const queue = context.getQueue() ?? (await context.createQueue(options));
    queue.add(addedQueueTracks);
    if (!queue.playing && !queue.paused) await queue.play();
    const meta = await getEmbedMeta(addedQueueTracks, true, queue);
    const description = truncateWithEllipsis(results.map(({title, uri, success, error}) => `${success ? '☑️' : `⚠️ (${error})`} ${hyperlink(truncateWithEllipsis(title, 50), uri ?? '')}`).join('\n'), 4096);
    await safeReply(currentInteraction, {
      flags: MessageFlags.Ephemeral,
      embeds: [
        new EmbedBuilder()
          .setTitle(`💿 즐겨찾기 ${addedQueueTracks.length}곡을 대기열에 추가했어요.`)
          .setDescription(description)
          .setFooter({text: meta.footerText})
          .setColor((meta.colors[0]?.hex?.() ?? COLORS.normal) as HexColorString),
      ],
      components: [],
    });
  });
}
