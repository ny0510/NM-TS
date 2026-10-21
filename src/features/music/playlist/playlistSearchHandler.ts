import {type ChatInputCommandInteraction, ComponentType, codeBlock, MessageFlags, PermissionsBitField, type StringSelectMenuInteraction} from 'discord.js';

import {ensureSameVoiceChannel, ensureVoiceChannel} from '@/features/music/guard';
import {addTrackToQueue} from '@/features/music/track/trackAdder';
import {getClient} from '@/shared/discord/client';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {safeDeferReply, safeDeferUpdate, safeEditReply, safeReply} from '@/shared/discord/interactions';
import {checkBotPermissions} from '@/shared/discord/permissions/checkPermissions';
import {formatMissingPermissions} from '@/shared/discord/permissions/formatPermissions';
import {toError} from '@/shared/errors';
import {buildPlaylistSearchMessage} from './playlistSearchBuilder';
import {searchYouTubePlaylists, YouTubePlaylistSearchError} from './youtubePlaylistSearch';

const SELECTION_TIMEOUT_MS = 5 * 60_000;

export async function handlePlaylistSearch(interaction: ChatInputCommandInteraction): Promise<void> {
  const client = getClient(interaction);
  const query = interaction.options.getString('query', true).trim();
  if (!query) {
    await safeReply(interaction, {embeds: [createErrorEmbed(client, '검색어를 입력해 주세요.')], flags: MessageFlags.Ephemeral});
    return;
  }
  if (!(await safeDeferReply(interaction, {flags: MessageFlags.Ephemeral}))) return;

  try {
    const playlists = await searchYouTubePlaylists(query);
    if (!playlists.length) {
      await safeEditReply(interaction, {embeds: [createErrorEmbed(client, '유튜브 플레이리스트를 찾을 수 없어요.', '다른 검색어로 다시 검색해 주세요.')]});
      return;
    }

    const customId = `search:playlist:${interaction.id}`;
    const messageOptions = buildPlaylistSearchMessage(playlists, query, customId);
    if (!(await safeEditReply(interaction, messageOptions))) return;
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: SELECTION_TIMEOUT_MS,
      max: 1,
      filter: selection => selection.user.id === interaction.user.id && selection.customId === customId && selection.values.length === 1 && playlists.some(playlist => playlist.id === selection.values[0]),
    });

    collector.once('collect', (selection: StringSelectMenuInteraction) => {
      const selected = playlists.find(playlist => playlist.id === selection.values[0]);
      if (!selected) return;

      const addPlaylist = async () => {
        if (!(await safeDeferUpdate(selection))) return;
        if (!(await ensureVoiceChannel(selection)) || !(await ensureSameVoiceChannel(selection))) return;

        const voiceChannel = selection.guild?.members.cache.get(selection.user.id)?.voice.channel;
        const {result, missing} = await checkBotPermissions(selection, [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak], voiceChannel);
        if (!result) {
          await safeReply(selection, {embeds: [createErrorEmbed(client, '음성 채널에 연결할 권한이 부족해요.', codeBlock('diff', formatMissingPermissions(missing)))], flags: MessageFlags.Ephemeral});
          return;
        }

        await addTrackToQueue(client, selection, {query: `https://www.youtube.com/playlist?list=${selected.id}`});
        await safeEditReply(selection, {components: []});
      };

      void addPlaylist().catch(async error => {
        client.logger.error(toError(error, 'Failed to add selected YouTube playlist'));
        await safeEditReply(selection, {embeds: [createErrorEmbed(client, '플레이리스트를 추가하는 중 오류가 발생했어요.', '잠시 후 다시 시도해 주세요.')]});
      });
    });

    collector.once('end', (_collected, reason) => {
      if (reason !== 'time') return;
      if (reason === 'time') messageOptions.embeds[0]?.setFooter({text: '검색 결과가 만료됐어요. /search 명령어로 다시 검색해 주세요.'});
      void safeEditReply(interaction, {...messageOptions, components: []});
    });
  } catch (error) {
    if (error instanceof YouTubePlaylistSearchError) {
      client.logger.error(error);
      await safeEditReply(interaction, {embeds: [createErrorEmbed(client, '유튜브 플레이리스트를 검색하지 못했어요.', '잠시 후 다시 시도해 주세요.')]});
      return;
    }
    client.logger.error(toError(error, 'Failed to show YouTube playlist search'));
    await safeEditReply(interaction, {embeds: [createErrorEmbed(client, '검색 결과를 표시하는 중 오류가 발생했어요.')]});
  }
}
