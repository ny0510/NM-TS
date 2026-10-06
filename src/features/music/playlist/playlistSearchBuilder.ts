import {ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder} from 'discord.js';

import {COLORS} from '@/shared/discord/embedColors';
import {truncateWithEllipsis} from '@/shared/formatting';
import type {YouTubePlaylist} from './youtubePlaylistSearch';

const RESULT_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'] as const;

export function buildPlaylistSearchMessage(playlists: readonly YouTubePlaylist[], query: string, customId: string) {
  const embed = new EmbedBuilder()
    .setTitle(truncateWithEllipsis(`🔍 유튜브 플레이리스트에서 ${query} 검색 결과`, 256))
    .setDescription('대기열에 추가할 플레이리스트를 선택해 주세요.')
    .setColor(COLORS.normal);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('플레이리스트를 선택해 주세요.')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(playlists.map((playlist, index) => ({label: truncateWithEllipsis(playlist.title, 100, ''), value: playlist.id, description: truncateWithEllipsis(playlist.author || '채널 정보 없음', 100, ''), emoji: RESULT_EMOJIS[index]})));

  return {embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], allowedMentions: {parse: []}};
}
