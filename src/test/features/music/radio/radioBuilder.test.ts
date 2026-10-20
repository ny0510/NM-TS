import {describe, expect, test} from 'bun:test';
import {ComponentType} from 'discord.js';

import {buildRadioComponents, buildRadioMessage, RADIO_STATIONS_PER_PAGE} from '@/features/music/radio/radioBuilder';
import {radioRegions} from '@/features/music/radio/radioStations';

const toRows = (selectedKey?: string, page?: number) => buildRadioComponents(radioRegions, selectedKey, page).map(row => row.toJSON());

describe('buildRadioComponents', () => {
  test('shows region buttons with a disabled channel menu before a region is selected', () => {
    const rows = toRows();

    expect(rows.map(row => row.components.length)).toEqual([5, 4, 1]);
    const menu = rows.at(-1)?.components[0];
    if (menu?.type !== ComponentType.StringSelect) throw new TypeError('Expected a channel dropdown');
    expect(menu.disabled).toBe(true);
  });

  test('pages regions with more than 25 channels and keeps every row within Discord limits', () => {
    for (const region of radioRegions) {
      const totalPages = Math.ceil(region.stations.length / RADIO_STATIONS_PER_PAGE);

      for (let page = 1; page <= totalPages; page++) {
        const rows = toRows(region.key, page);
        const menuRow = rows[2];
        const menu = menuRow?.components[0];
        if (menu?.type !== ComponentType.StringSelect) throw new TypeError('Expected a channel dropdown');

        expect(rows.length).toBeLessThanOrEqual(5);
        expect(rows.length).toBe(totalPages > 1 ? 4 : 3);
        expect(menu.options.length).toBeLessThanOrEqual(RADIO_STATIONS_PER_PAGE);
        expect(menu.options[0]?.value).toBe(String((page - 1) * RADIO_STATIONS_PER_PAGE));
        expect(menu.options.every(option => option.label.length <= 100 && (option.description?.length ?? 0) <= 100)).toBe(true);

        const customIds = rows.flatMap(row => row.components.map(component => ('custom_id' in component ? component.custom_id : '')));
        expect(new Set(customIds).size).toBe(customIds.length);
      }
    }
  });

  test('highlights the selected region and shows its channel count in the footer', () => {
    const region = radioRegions[0];
    if (!region) throw new TypeError('Expected at least one radio region');

    const message = buildRadioMessage(radioRegions, region.key);
    const selected = message.components[0]?.toJSON().components[0];

    expect(selected && 'style' in selected ? selected.style : undefined).toBe(1);
    expect(message.embeds[0]?.toJSON().footer?.text).toBe(`${region.label} · ${region.stations.length}개 채널`);
  });
});
