const RADIO_URI_PATTERN = /^nm-radio:([a-z]+:[a-z0-9]+:[a-z0-9]+)$/;
const LEGACY_RADIO_URL_PATTERN = /^https:\/\/radio\.bsod\.kr\/stream\?stn=([a-z]+)(?:&ch=([a-z0-9]+))?(?:&city=([a-z0-9]+))?$/;

export const getRadioTrackUri = (stationId: string): string => `nm-radio:${stationId}`;

// Decode old snapshots locally; never use their URL for playback.
export function getRadioStationId(uri: string | null | undefined): string | undefined {
  if (typeof uri !== 'string' || uri.trim() !== uri) return undefined;
  const current = RADIO_URI_PATTERN.exec(uri);
  if (current) return current[1];
  const legacy = LEGACY_RADIO_URL_PATTERN.exec(uri);
  return legacy ? `${legacy[1]}:${legacy[2] ?? 'default'}:${legacy[3] ?? 'default'}` : undefined;
}

// Classification only: playback authorization must check the catalog allowlist.
export const isRadioUrl = (url: string | null | undefined): boolean => getRadioStationId(url) !== undefined;

export const isRadioTrack = (track: {readonly info: {readonly uri?: string | null}} | null | undefined): boolean => isRadioUrl(track?.info.uri);
