import {expect, test} from 'bun:test';
import {ComponentType} from 'discord.js';
import {buildFrequencyDial, buildRadioMessage, DIAL_SEGMENTS, dialPosition, FM_MAX_KHZ, FM_MIN_KHZ, formatFrequency} from '@/features/radio/radioBuilder';
import {getFmStations, radioRegions} from '@/features/radio/radioStations';
import type {ProgressBarConfig} from '@/types/client';

const progress: ProgressBarConfig = {PROGRESS_CIRCLE_START: 'S', PROGRESS_CIRCLE_MIDDLE: 'C', PROGRESS_FILLED_START: 'F', PROGRESS_FILLED_MIDDLE: 'f', PROGRESS_UNFILLED_MIDDLE: '-', PROGRESS_UNFILLED_END: 'E'};

test('every station is visible in one message within Discord component limits', () => {
  for (const region of radioRegions) {
    const seen = new Set<string>();
    const result = buildRadioMessage({regionKey: region.key}, undefined, progress);
    expect(result.components.length).toBeLessThanOrEqual(5);
    const embed = result.embeds[0]?.toJSON();
    expect(embed?.description?.length).toBeLessThan(4096);
    for (const row of result.components) {
      const json = row.toJSON();
      expect(json.components.length).toBeLessThanOrEqual(5);
      for (const component of json.components) {
        if ('custom_id' in component) expect(component.custom_id.length).toBeLessThanOrEqual(100);
        if (component.type === ComponentType.StringSelect) {
          expect(json.components).toHaveLength(1);
          expect(component.options.length).toBeLessThanOrEqual(25);
          if (component.custom_id.startsWith('radio:station:'))
            for (const option of component.options) {
              seen.add(option.value);
              expect(option.label.length).toBeLessThanOrEqual(100);
              expect(option.description?.length ?? 0).toBeLessThanOrEqual(100);
            }
        }
      }
    }
    expect([...seen].sort()).toEqual(region.stations.map(item => item.id).sort());
    const buttons = result.components.flatMap(row => row.toJSON().components).filter(component => component.type === ComponentType.Button);
    const fmMenus = result.components.flatMap(row => row.toJSON().components).filter(component => component.type === ComponentType.StringSelect && component.custom_id.includes(':fm:'));
    expect(fmMenus.length).toBeLessThanOrEqual(1);
    expect(buttons.map(button => ('custom_id' in button ? button.custom_id : undefined))).toEqual(['radio:lower', 'radio:higher', 'radio:refresh']);
    expect(buttons.every(button => (!('label' in button) || !button.label) && 'emoji' in button && button.emoji?.name)).toBe(true);
  }
});

test('reopens active station frequency and retains controls until view expiry', () => {
  const region = radioRegions[0];
  const station = region && getFmStations(region)[0];
  if (!region || !station) throw new Error('Missing FM fixture');
  const active = {sessionId: 'radio', regionKey: region.key, station, paused: false, volume: 20};
  const view = {regionKey: region.key};
  const result = buildRadioMessage(view, active, progress);
  expect(result.embeds[0]?.toJSON().title).toBe(`📻 ${station.name} (${formatFrequency(station)})`);
  expect(result.embeds[0]?.toJSON().description).not.toContain(formatFrequency(station));
  expect(result.components.length).toBeGreaterThan(0);
  const expired = buildRadioMessage(view, active, progress, true);
  expect(expired.components).toEqual([]);
  expect(expired.embeds[0]?.toJSON().footer).toBeUndefined();
  expect(JSON.stringify(result.embeds[0]?.toJSON())).not.toContain('볼륨');
  expect(result.embeds[0]?.toJSON().description).not.toContain('방송국 위치');
  expect(JSON.stringify(result.embeds[0]?.toJSON())).not.toContain('조작 화면');
});

test('frequency dial uses existing emoji, optional station markers and correct physical bounds', () => {
  const region = radioRegions[0];
  const station = region && getFmStations(region)[0];
  if (!region || !station) throw new Error('Missing FM fixture');
  expect(dialPosition(FM_MIN_KHZ)).toBe(0);
  expect(dialPosition(FM_MAX_KHZ)).toBe(DIAL_SEGMENTS - 1);
  const base = buildFrequencyDial(region, station, progress);
  expect(base).toHaveLength(DIAL_SEGMENTS);
  expect(base[dialPosition(station.frequencyKHz ?? 0)]).toBe('C');
  const custom = buildFrequencyDial(region, station, {...progress, RADIO_MARKER_FILLED_START: 'm', RADIO_MARKER_FILLED_MIDDLE: 'm', RADIO_MARKER_UNFILLED_MIDDLE: 'm', RADIO_MARKER_UNFILLED_END: 'm'});
  expect(custom).toContain('m');
  expect(custom).toContain('C');
  const other = region.stations.find(item => item.band === 'other');
  expect(buildFrequencyDial(region, other, progress)).not.toContain('C');
});
