import {ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, inlineCode} from 'discord.js';

import type {NMClient} from '@/client/Client';
import {truncateWithEllipsis} from '@/shared/formatting';
import {COLORS} from '@/shared/discord/embedColors';
import {type ChartRankingRow, getTotalPlayCount} from './data';

export const TRACKS_PER_PAGE = 5;

function getRankChangeIndicator(rankChange: number | null): string {
  if (rankChange === null) return '🆕';
  if (rankChange > 0) return `🔺${rankChange}`;
  if (rankChange < 0) return `🔻${Math.abs(rankChange)}`;
  return '➖';
}

export function buildChartEmbed(client: NMClient, ranking: ChartRankingRow[], page: number, totalPages: number, monthLabel: string, isGlobal: boolean, guildName: string | null): EmbedBuilder {
  const start = (page - 1) * TRACKS_PER_PAGE;
  const end = Math.min(start + TRACKS_PER_PAGE, ranking.length);
  const pageItems = ranking.slice(start, end);
  const totalPlayCount = getTotalPlayCount(ranking);

  const scopeLabel = isGlobal ? '글로벌' : (guildName ?? '이 서버');

  const trackList = pageItems.map((item: ChartRankingRow, i: number) => ({
    name: `${start + i + 1}. ${truncateWithEllipsis(item.title, 50)}`,
    value: `┕ ${truncateWithEllipsis(item.artist, 50)} · ${inlineCode(`${item.playCount}회`)} · ${getRankChangeIndicator(item.rankChange)}`,
  }));

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${monthLabel} ${scopeLabel} 음악 차트`)
    .addFields(trackList)
    .setColor(COLORS.normal)
    .setFooter({
      text: [totalPages > 1 ? `${page}/${totalPages} 페이지` : null, `총 ${ranking.length}곡 · ${totalPlayCount}회 재생`].filter(Boolean).join(' · '),
    });

  return embed;
}

export function buildChartButtons(page: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('chart_previous')
      .setEmoji('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId('chart_page')
      .setLabel(`${page}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(totalPages <= 1),
    new ButtonBuilder()
      .setCustomId('chart_next')
      .setEmoji('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
    new ButtonBuilder().setCustomId('chart_refresh').setLabel('새로고침').setEmoji('🔄').setStyle(ButtonStyle.Primary),
  );
}
