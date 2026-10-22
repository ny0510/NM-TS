import {describe, expect, test} from 'bun:test';

import {radioRegions} from '@/features/radio/radioStations';
import {getRadioStationId, getRadioTrackUri, isRadioTrack} from '@/shared/playback/radioUrl';
import type {QueueTrack} from '@/types/music';

const createTrack = (uri: string | null): QueueTrack => ({encoded: 'encoded', info: {identifier: 'id', isSeekable: false, author: 'author', length: 0, isStream: true, position: 0, title: 'title', uri: uri ?? undefined, sourceName: 'http'}, pluginInfo: undefined});

describe('radio identity', () => {
  test('decodes local URIs and legacy URLs without fetching', () => {
    expect(getRadioStationId(getRadioTrackUri('kbs:1radio:default'))).toBe('kbs:1radio:default');
    expect(getRadioStationId('https://radio.bsod.kr/stream?stn=kbs&ch=1radio')).toBe('kbs:1radio:default');
    expect(getRadioStationId('https://radio.bsod.kr/stream?stn=tbn&city=jeju')).toBe('tbn:default:jeju');
    expect(getRadioStationId('https://radio.bsod.kr/stream?stn=kookbang')).toBe('kookbang:default:default');
  });
});

describe('radioRegions', () => {
  test('lists every region in order with unique stream URLs per region', () => {
    expect(radioRegions.map(region => region.label)).toEqual(['서울·수도권', '부산', '울산', '경남', '대구', '경북', '광주', '전남', '대전', '세종', '충남', '강원', '충북', '전북', '제주']);
    expect(radioRegions.length).toBeLessThanOrEqual(25);

    for (const region of radioRegions) {
      expect(new Set(region.stations.map(station => station.id)).size).toBe(region.stations.length);
      expect(region.stations.every(station => station.name && station.provider)).toBe(true);
    }
  });
});

describe('isRadioTrack', () => {
  test('matches local radio track identities', () => {
    const stationUrl = getRadioTrackUri(radioRegions[0]?.stations[0]?.id ?? '');

    expect(isRadioTrack(createTrack(stationUrl))).toBe(true);
    expect(isRadioTrack(createTrack('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))).toBe(false);
    expect(isRadioTrack(createTrack(null))).toBe(false);
    expect(isRadioTrack(null)).toBe(false);
  });
});
