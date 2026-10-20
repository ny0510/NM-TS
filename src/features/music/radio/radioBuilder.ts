import {ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type MessageActionRowComponentBuilder, StringSelectMenuBuilder} from 'discord.js';

import {COLORS} from '@/shared/discord/embedColors';
import {truncateWithEllipsis} from '@/shared/formatting';
import type {RadioRegion} from './radioStations';

export const RADIO_STATIONS_PER_PAGE = 25;
const MAX_REGIONS = 15;
const REGIONS_PER_ROW = 5;

export function getRadioPageCount(region: RadioRegion): number {
  return Math.max(1, Math.ceil(region.stations.length / RADIO_STATIONS_PER_PAGE));
}

export function clampRadioPage(region: RadioRegion, page: number): number {
  return Math.max(1, Math.min(page, getRadioPageCount(region)));
}

export function buildRadioEmbed(region?: RadioRegion): EmbedBuilder {
  const embed = new EmbedBuilder().setTitle('📻 라디오').setDescription('지역을 선택한 뒤 대기열에 추가할 라디오 채널을 선택해 주세요.').setColor(COLORS.normal);
  if (region) embed.setFooter({text: `${region.label} · ${region.stations.length}개 채널`});
  return embed;
}

export function buildRadioComponents(regions: readonly RadioRegion[], selectedKey?: string, page = 1): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const visibleRegions = regions.slice(0, MAX_REGIONS);
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  for (let i = 0; i < visibleRegions.length; i += REGIONS_PER_ROW) {
    rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        visibleRegions.slice(i, i + REGIONS_PER_ROW).map(region =>
          new ButtonBuilder()
            .setCustomId(`radio:region:${region.key}`)
            .setLabel(region.label)
            .setStyle(region.key === selectedKey ? ButtonStyle.Primary : ButtonStyle.Secondary),
        ),
      ),
    );
  }

  const region = visibleRegions.find(item => item.key === selectedKey);
  if (!region) {
    rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId('radio:select:none').setPlaceholder('먼저 지역을 선택해 주세요.').setDisabled(true).addOptions({label: '-', value: 'none'})));
    return rows;
  }

  const totalPages = getRadioPageCount(region);
  const currentPage = clampRadioPage(region, page);
  const start = (currentPage - 1) * RADIO_STATIONS_PER_PAGE;

  rows.push(
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`radio:select:${region.key}`)
        .setPlaceholder('라디오 채널을 선택해 주세요.')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          region.stations.slice(start, start + RADIO_STATIONS_PER_PAGE).map((station, index) => ({
            label: truncateWithEllipsis(station.name, 100, ''),
            value: String(start + index),
            description: truncateWithEllipsis(station.provider, 100, ''),
          })),
        ),
    ),
  );

  if (totalPages > 1) {
    rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`radio:page:${region.key}:${currentPage - 1}`)
          .setEmoji('◀')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage <= 1),
        new ButtonBuilder().setCustomId('radio:page_info').setLabel(`${currentPage}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`radio:page:${region.key}:${currentPage + 1}`)
          .setEmoji('▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage >= totalPages),
      ),
    );
  }

  return rows;
}

export function buildRadioMessage(regions: readonly RadioRegion[], selectedKey?: string, page = 1) {
  return {embeds: [buildRadioEmbed(regions.find(region => region.key === selectedKey))], components: buildRadioComponents(regions, selectedKey, page)};
}

export function buildRadioAddedEmbed(stationName: string, uri: string, footerText: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(truncateWithEllipsis(`📻 ${stationName}`, 50))
    .setDescription('라디오를 대기열에 추가했어요.')
    .setURL(uri)
    .setFooter({text: footerText})
    .setColor(COLORS.normal);
}

export function buildRadioExpiredEmbed(commandMention: string): EmbedBuilder {
  return new EmbedBuilder().setTitle(`만료된 인터렉션이에요. ${commandMention} 명령어를 사용해 다시 선택해 주세요.`).setColor(COLORS.error);
}
