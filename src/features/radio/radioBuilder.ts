import {ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type MessageActionRowComponentBuilder, StringSelectMenuBuilder} from 'discord.js';
import {COLORS} from '@/shared/discord/embedColors';
import type {ProgressBarConfig} from '@/types/client';
import type {RadioRegion, RadioStation} from '@/types/radio';
import {getFmStations, radioRegions} from './radioStations';

export const RADIO_STATIONS_PER_PAGE = 25;
export const FM_MIN_KHZ = 87_500;
export const FM_MAX_KHZ = 108_000;
export const DIAL_SEGMENTS = 14;
export interface RadioViewState {
  regionKey: string;
}
export interface RadioDisplay {
  sessionId: string;
  regionKey: string | undefined;
  station: RadioStation | undefined;
  paused: boolean;
}

export function formatFrequency(station: RadioStation): string {
  return station.frequencyKHz !== undefined ? `${(station.frequencyKHz / 1000).toFixed(1)} MHz` : station.band === 'unknown' ? '주파수 미확인' : '인터넷·기타';
}
export function dialPosition(frequencyKHz: number): number {
  return Math.max(0, Math.min(DIAL_SEGMENTS - 1, Math.round(((frequencyKHz - FM_MIN_KHZ) / (FM_MAX_KHZ - FM_MIN_KHZ)) * (DIAL_SEGMENTS - 1))));
}

export function buildFrequencyDial(region: RadioRegion, station: RadioStation | undefined, config: ProgressBarConfig): string {
  const cursor = station?.frequencyKHz === undefined ? -1 : dialPosition(station.frequencyKHz);
  const markers = new Set(getFmStations(region).map(item => dialPosition(item.frequencyKHz ?? FM_MIN_KHZ)));
  return Array.from({length: DIAL_SEGMENTS}, (_, index) => {
    const edge = index === 0 ? 'START' : index === DIAL_SEGMENTS - 1 ? 'END' : 'MIDDLE';
    if (index === cursor) return edge === 'START' ? config.PROGRESS_CIRCLE_START : edge === 'END' ? config.RADIO_CIRCLE_END || config.PROGRESS_CIRCLE_MIDDLE : config.PROGRESS_CIRCLE_MIDDLE;
    const filled = cursor >= 0 && index < cursor;
    if (markers.has(index)) {
      const marker = config[`RADIO_MARKER_${filled ? 'FILLED' : 'UNFILLED'}_${edge}`];
      if (marker) return marker;
    }
    if (filled) return edge === 'START' ? config.PROGRESS_FILLED_START : edge === 'END' ? config.RADIO_FILLED_END || config.PROGRESS_FILLED_MIDDLE : config.PROGRESS_FILLED_MIDDLE;
    return edge === 'END' ? config.PROGRESS_UNFILLED_END : edge === 'START' ? config.RADIO_UNFILLED_START || config.PROGRESS_UNFILLED_MIDDLE : config.PROGRESS_UNFILLED_MIDDLE;
  }).join('');
}

function stationMenu(stations: readonly RadioStation[], regionKey: string, kind: 'fm' | 'other', index: number, selectedId?: string) {
  const first = stations[0];
  const last = stations.at(-1);
  const range = kind === 'fm' && first && last ? ` · ${formatFrequency(first).replace(' MHz', '')}–${formatFrequency(last)}` : '';
  const menu = new StringSelectMenuBuilder().setCustomId(`radio:station:${regionKey}:${kind}:${index}`).setPlaceholder(`${kind === 'fm' ? 'FM 방송국' : '기타 채널'}${range}`);
  menu.addOptions(stations.map(station => ({label: station.name.slice(0, 100), value: station.id, description: `${formatFrequency(station)} · ${station.locality ?? station.provider}`.slice(0, 100), default: station.id === selectedId})));
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

export function buildRadioMessage(view: RadioViewState, active: RadioDisplay | undefined, config: ProgressBarConfig, expired = false, commandMention = '/radio') {
  if (expired) return {embeds: [new EmbedBuilder().setTitle(`만료된 인터렉션이에요. ${commandMention} 명령어를 사용해 다시 확인해 주세요.`).setColor(COLORS.normal)], components: []};
  const region = radioRegions.find(item => item.key === view.regionKey) ?? radioRegions[0];
  if (!region) throw new Error('Radio catalog is empty');
  const station = active?.regionKey === region.key ? active.station : undefined;
  const fm = getFmStations(region);
  const other = region.stations.filter(item => item.frequencyKHz === undefined);
  const hasMarkerEmoji = Boolean(config.RADIO_MARKER_UNFILLED_MIDDLE && config.RADIO_MARKER_FILLED_MIDDLE);
  const markerRow = Array.from({length: DIAL_SEGMENTS}, (_, index) => (fm.some(item => dialPosition(item.frequencyKHz ?? FM_MIN_KHZ) === index) ? '●' : '·')).join(' ');
  const description = `${region.label}${active?.station && active.paused ? ' · 일시정지' : ''}\n${buildFrequencyDial(region, station, config)}${!hasMarkerEmoji ? `\n\`${markerRow}\`` : ''}\n\`87.5 — 108.0 MHz\``;
  const embed = new EmbedBuilder()
    .setTitle(active?.station ? `📻 ${active.station.name}${active.station.frequencyKHz !== undefined ? ` (${formatFrequency(active.station)})` : ''}` : '📻 라디오')
    .setDescription(description)
    .setColor(COLORS.normal);
  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  if (!expired) {
    components.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('radio:region')
          .setPlaceholder('지역 선택')
          .addOptions(radioRegions.map(item => ({label: item.label, value: item.key, default: item.key === region.key}))),
      ),
    );
    for (const [kind, stations] of [
      ['fm', fm],
      ['other', other],
    ] as const) {
      for (let start = 0; start < stations.length; start += RADIO_STATIONS_PER_PAGE) {
        components.push(stationMenu(stations.slice(start, start + RADIO_STATIONS_PER_PAGE), region.key, kind, start / RADIO_STATIONS_PER_PAGE, station?.id));
      }
    }
    components.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder().setCustomId('radio:lower').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(!fm.length),
        new ButtonBuilder().setCustomId('radio:higher').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(!fm.length),
        new ButtonBuilder().setCustomId('radio:refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      ),
    );
  }
  return {embeds: [embed], components};
}
