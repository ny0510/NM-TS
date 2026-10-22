import {z} from 'zod';
import type {RadioRegion, RadioStation} from '@/types/radio';
import catalogData from '../../../data/radio/stations.json';

export {isRadioTrack} from '@/shared/playback/radioUrl';
export type {RadioRegion, RadioStation} from '@/types/radio';

const stationSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  band: z.enum(['fm', 'other', 'unknown']),
  frequencyKHz: z.number().int().optional(),
  locality: z.string().optional(),
});
const catalog = z
  .object({
    legacyGroups: z.record(z.string(), z.array(z.string())),
    regions: z.array(z.object({key: z.string(), label: z.string(), stations: z.array(stationSchema)})),
  })
  .parse(catalogData);

export const radioRegions: readonly RadioRegion[] = catalog.regions;
const stationsById = new Map(radioRegions.flatMap(region => region.stations.map(station => [station.id, station] as const)));

export const findRadioStationById = (stationId: string): RadioStation | undefined => stationsById.get(stationId);
export const findRadioStation = (regionKey: string, stationId: string): RadioStation | undefined => radioRegions.find(region => region.key === regionKey)?.stations.find(station => station.id === stationId);

export function resolveRadioRegionKey(regionKey: string, stationId: string): string {
  if (findRadioStation(regionKey, stationId)) return regionKey;
  return catalog.legacyGroups[regionKey]?.find(key => findRadioStation(key, stationId)) ?? regionKey;
}

export const getFmStations = (region: RadioRegion): RadioStation[] => region.stations.filter(station => station.band === 'fm' && station.frequencyKHz !== undefined).sort((a, b) => (a.frequencyKHz ?? 0) - (b.frequencyKHz ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

export function getAdjacentStation(region: RadioRegion, current: RadioStation | undefined, direction: 'lower' | 'higher'): RadioStation | undefined {
  const stations = getFmStations(region);
  const frequency = current?.band === 'fm' ? current.frequencyKHz : undefined;
  const higher = direction === 'higher';
  const ordered = higher ? stations : stations.toReversed();
  const next = ordered.find(station => frequency === undefined || (higher ? (station.frequencyKHz ?? 0) > frequency : (station.frequencyKHz ?? 0) < frequency)) ?? ordered[0];
  return stations.find(station => station.frequencyKHz === next?.frequencyKHz);
}
